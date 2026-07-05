// tests/integration/AIWorkflowPlan.test.ts
// Integration test for the new structured AI Workflow pipeline:
// prompt -> parse -> build plan -> validate -> execute -> atomic history.
// Does not touch the pre-existing tests/integration/AIWorkflow.test.ts,
// which still covers the original simple pipeline unmodified.

import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parsePrompt } from '../../src/ai/AIPromptParser'
import { buildPlan } from '../../src/ai/AIPlanBuilder'
import { validatePlan } from '../../src/ai/AIPlanValidator'
import { executePlan } from '../../src/ai/AIOperationExecutor'
import { buildEditorContext } from '../../src/ai/AIContextBuilder'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'
import type { AITransactionAdapter } from '../../src/ai/planTypes'

beforeEach(() => {
  setActivePinia(createPinia())
})

function makeFakeAdapter() {
  const record = { committed: false, cancelled: false }
  const adapter: AITransactionAdapter = {
    begin() {},
    updateSnapshot() {},
    async commit() { record.committed = true },
    cancel() { record.cancelled = true },
  }
  return { adapter, record }
}

async function runPrompt(prompt: string, adapter: AITransactionAdapter) {
  const context = buildEditorContext()
  const plan = buildPlan(parsePrompt(prompt), context, prompt)
  const errors = validatePlan(plan, context)
  const blocking = errors.filter(e => !e.recoverable)
  if (blocking.length > 0) return { plan, errors, result: null }
  const result = await executePlan(plan, adapter)
  return { plan, errors, result }
}

describe('AI Workflow — full pipeline', () => {
  it('creates 3 objects from a count prompt', async () => {
    const { adapter } = makeFakeAdapter()
    const { result } = await runPrompt('Create 3 blue rectangles', adapter)
    expect(result?.success).toBe(true)
    const scene = useSceneStore()
    expect(scene.objects).toHaveLength(3)
    expect(scene.objects.every(o => o.fill === '#3b82f6')).toBe(true)
  })

  it('handles a full multi-step instruction as one atomic transaction', async () => {
    const { adapter, record } = makeFakeAdapter()
    const { result } = await runPrompt('Create a rectangle, make it blue and center it', adapter)

    expect(result?.success).toBe(true)
    expect(record.committed).toBe(true)

    const scene = useSceneStore()
    expect(scene.objects).toHaveLength(1)
    const obj = scene.objects[0]!
    expect(obj.fill).toBe('#3b82f6')
    expect(obj.x).toBe(-obj.width / 2) // "centered" per move-object's toCenter behavior
  })

  it('creates two rectangles then groups them via a follow-up instruction', async () => {
    const { adapter } = makeFakeAdapter()
    await runPrompt('Create 2 rectangles', adapter)

    const { adapter: adapter2 } = makeFakeAdapter()
    const { result } = await runPrompt('Select all rectangles and group them', adapter2)
    expect(result?.success).toBe(true)

    const scene = useSceneStore()
    const group = scene.objects.find(o => o.type === 'group')
    expect(group).toBeDefined()
    const children = scene.objects.filter(o => o.parentId === group?.id)
    expect(children).toHaveLength(2)
  })

  it('select -> align -> distribute chains the same resolved target set across steps', async () => {
    const { adapter } = makeFakeAdapter()
    await runPrompt('Create 3 circles', adapter)

    // Perturb positions first — the 3 circles are otherwise created already
    // evenly spaced, which would make align/distribute a no-op and this
    // test tautological.
    const scene = useSceneStore()
    scene.objects.forEach((o, i) => scene.updateObject(o.id, { x: i * 37 + 5, y: i * 91 + 3 }))

    const { adapter: adapter2 } = makeFakeAdapter()
    const { result } = await runPrompt(
      'Select all circles, align them at the top and distribute them horizontally',
      adapter2
    )
    expect(result?.success).toBe(true)

    const ys = scene.objects.map(o => o.y)
    expect(new Set(ys).size).toBe(1) // all aligned to the same top edge

    const xs = scene.objects.map(o => o.x).sort((a, b) => a - b)
    const gap1 = xs[1]! - xs[0]!
    const gap2 = xs[2]! - xs[1]!
    expect(gap1).toBeCloseTo(gap2, 5) // evenly distributed horizontally
  })

  it('does not mutate the scene for an unresolvable delete (validation blocks execution before it runs)', async () => {
    const { adapter } = makeFakeAdapter()
    const { result, errors } = await runPrompt('Delete the second circle', adapter)

    expect(result).toBeNull() // blocked before execution — no circles exist to resolve "the second circle" against
    expect(errors.some(e => e.code === 'NO_TARGETS_RESOLVED')).toBe(true)
    const scene = useSceneStore()
    expect(scene.objects).toHaveLength(0)
  })

  it('respects a locked object: the plan flags it, and it is not silently changed', async () => {
    const scene = useSceneStore()
    const selection = useSelectionStore()
    const obj = scene.addObject({ type: 'rectangle', x: 0, y: 0 })
    scene.toggleLocked(obj.id)
    selection.select(obj.id)

    const context = buildEditorContext()
    const plan = buildPlan(parsePrompt('Change color to red'), context, 'Change color to red')
    expect(plan.requiresConfirmation).toBe(true)

    const errors = validatePlan(plan, context)
    expect(errors.some(e => e.code === 'LOCKED_TARGET')).toBe(true)
  })

  it('blocks a plan that ungroups a non-group target during validation, before anything executes', async () => {
    const scene = useSceneStore()
    const selection = useSelectionStore()
    const obj = scene.addObject({ type: 'rectangle', x: 0, y: 0 })
    selection.select(obj.id)

    const { errors, result } = await runPrompt('Change color to green and ungroup it', makeFakeAdapter().adapter)

    expect(errors.some(e => e.code === 'INVALID_TARGET_TYPE')).toBe(true)
    expect(result).toBeNull() // never reached execution
    expect(scene.objects.find(o => o.id === obj.id)?.fill).not.toBe('#22c55e') // color step never ran either
  })

  it('rolls back the entire batch if an operation fails mid-execution (a hand-built batch simulating an unexpected runtime failure)', async () => {
    const { adapter, record } = makeFakeAdapter()
    const scene = useSceneStore()
    const obj = scene.addObject({ type: 'rectangle', x: 0, y: 0 })

    // A real update followed by an operation whose target ref was never
    // declared by an earlier step — exactly the class of failure the
    // executor must roll back atomically.
    const plan = {
      id: 'plan-1', originalPrompt: 'x', summary: 'x', warnings: [], requiresConfirmation: false, createdAt: Date.now(),
      operations: [
        { id: 'op-1', type: 'update-object' as const, target: { objectId: obj.id }, changes: { fill: '#22c55e' } },
        { id: 'op-2', type: 'move-object' as const, target: { ref: 'never-declared' }, toCenter: true },
      ],
    }

    const result = await executePlan(plan, adapter)

    expect(result.success).toBe(false)
    expect(record.cancelled).toBe(true)
    expect(record.committed).toBe(false)
    expect(scene.objects.find(o => o.id === obj.id)?.fill).not.toBe('#22c55e')
  })
})
