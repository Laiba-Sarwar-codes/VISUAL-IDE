// tests/unit/AIOperationExecutor.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nanoid } from 'nanoid'
import { useSceneStore } from '~/stores/scene'
import { executePlan } from '../../src/ai/AIOperationExecutor'
import type { AIExecutionPlan, AIPlanOperation, AITransactionAdapter } from '../../src/ai/planTypes'

beforeEach(() => {
  setActivePinia(createPinia())
})

function makePlan(operations: AIPlanOperation[], warnings: string[] = []): AIExecutionPlan {
  return {
    id: nanoid(), originalPrompt: 'test prompt', summary: 'test',
    operations, warnings, requiresConfirmation: false, createdAt: Date.now(),
  }
}

function makeFakeAdapter() {
  const record = { committed: false, cancelled: false, began: null as string | null }
  const adapter: AITransactionAdapter = {
    begin(label: string) { record.began = label },
    updateSnapshot() {},
    async commit() { record.committed = true },
    cancel() { record.cancelled = true },
  }
  return { adapter, record }
}

describe('executePlan — successful atomic execution', () => {
  it('executes a create-object operation and commits the transaction', async () => {
    const { adapter, record } = makeFakeAdapter()
    const plan = makePlan([{ id: nanoid(), type: 'create-object', objectType: 'rectangle', x: 10, y: 20 }])

    const result = await executePlan(plan, adapter)

    expect(result.success).toBe(true)
    expect(result.createdObjectIds).toHaveLength(1)
    expect(result.executedOperationCount).toBe(1)
    expect(record.began).toContain('AI:')
    expect(record.committed).toBe(true)
    expect(record.cancelled).toBe(false)

    const scene = useSceneStore()
    expect(scene.objects).toHaveLength(1)
  })

  it('resolves resultRef -> target.ref across operations (temp-ref chaining)', async () => {
    const { adapter } = makeFakeAdapter()
    const plan = makePlan([
      { id: nanoid(), type: 'create-object', objectType: 'rectangle', resultRef: 'r1' },
      { id: nanoid(), type: 'update-object', target: { ref: 'r1' }, changes: { fill: '#3b82f6' } },
    ])

    const result = await executePlan(plan, adapter)

    expect(result.success).toBe(true)
    const scene = useSceneStore()
    expect(scene.objects[0]?.fill).toBe('#3b82f6')
  })

  it('uses the existing scene store actions for align — same path as a manual edit, so collaboration sync is unaffected', async () => {
    const { adapter } = makeFakeAdapter()
    const scene = useSceneStore()
    const a = scene.addObject({ type: 'rectangle', x: 0, y: 0 })
    const b = scene.addObject({ type: 'rectangle', x: 50, y: 100 })

    const plan = makePlan([
      { id: nanoid(), type: 'align-objects', targets: [{ objectId: a.id }, { objectId: b.id }], edge: 'left' },
    ])
    const result = await executePlan(plan, adapter)

    expect(result.success).toBe(true)
    const aAfter = scene.objects.find(o => o.id === a.id)
    const bAfter = scene.objects.find(o => o.id === b.id)
    expect(bAfter?.x).toBe(aAfter?.x)
  })

  it('produces a well-formed AIExecutionResult', async () => {
    const { adapter } = makeFakeAdapter()
    const plan = makePlan([{ id: nanoid(), type: 'create-object', objectType: 'rectangle' }])
    const result = await executePlan(plan, adapter)

    expect(result.planId).toBe(plan.id)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.affectedObjectIds).toHaveLength(1)
    expect(result.warnings).toEqual(plan.warnings)
  })
})

describe('executePlan — rollback on failure', () => {
  it('rolls back every change and cancels the transaction when an operation mid-batch fails', async () => {
    const { adapter, record } = makeFakeAdapter()
    const plan = makePlan([
      { id: nanoid(), type: 'create-object', objectType: 'rectangle' },
      { id: nanoid(), type: 'move-object', target: { objectId: 'does-not-exist' }, toCenter: true },
    ])

    const result = await executePlan(plan, adapter)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(record.cancelled).toBe(true)
    expect(record.committed).toBe(false)

    const scene = useSceneStore()
    expect(scene.objects).toHaveLength(0) // the first create is rolled back too — no partial state
  })

  it('rolls back a failed delete without leaving other objects modified', async () => {
    const { adapter } = makeFakeAdapter()
    const scene = useSceneStore()
    const kept = scene.addObject({ type: 'rectangle', x: 1, y: 2 })

    // An undeclared ref (not a raw objectId) — resolveTarget correctly
    // returns null for this, which the executor treats as "no targets
    // resolved" and throws. A raw objectId that merely doesn't exist in
    // the scene would instead hit scene.removeObject's own silent
    // no-op-on-missing-id behavior, which wouldn't exercise a genuine
    // failure/rollback path.
    const plan = makePlan([
      { id: nanoid(), type: 'set-opacity', targets: [{ objectId: kept.id }], opacity: 0.4 },
      { id: nanoid(), type: 'delete-object', targets: [{ ref: 'never-declared' }] },
    ])
    const result = await executePlan(plan, adapter)

    expect(result.success).toBe(false)
    const restored = scene.objects.find(o => o.id === kept.id)
    expect(restored?.opacity).toBe(1) // rolled back to its pre-plan value
  })
})

describe('executePlan — default transaction adapter', () => {
  it('falls back gracefully (no throw) when PersistentHistoryService is unavailable', async () => {
    const scene = useSceneStore()
    const plan = makePlan([{ id: nanoid(), type: 'create-object', objectType: 'rectangle' }])

    const result = await executePlan(plan) // no adapter injected

    expect(result.success).toBe(true)
    expect(scene.objects).toHaveLength(1)
  })
})
