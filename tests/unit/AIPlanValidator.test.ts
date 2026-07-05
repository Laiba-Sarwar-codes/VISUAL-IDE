// tests/unit/AIPlanValidator.test.ts
import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { validatePlan } from '../../src/ai/AIPlanValidator'
import type { AIContextObject, AIEditorContext, AIExecutionPlan, AIPlanOperation } from '../../src/ai/planTypes'

function makeContextObject(overrides: Partial<AIContextObject> = {}): AIContextObject {
  return {
    id: overrides.id ?? 'obj-1',
    type: overrides.type ?? 'rectangle',
    name: overrides.name ?? 'Rectangle 1',
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 100,
    height: overrides.height ?? 100,
    zIndex: overrides.zIndex ?? 0,
    visible: overrides.visible ?? true,
    locked: overrides.locked ?? false,
    opacity: overrides.opacity ?? 1,
    parentId: overrides.parentId ?? null,
  }
}

function makeContext(objects: AIContextObject[] = []): AIEditorContext {
  return {
    objects,
    selectedObjectIds: [],
    viewport: { left: -800, top: -450, right: 800, bottom: 450 },
    supportedObjectTypes: ['rectangle', 'ellipse', 'text', 'image', 'group', 'folder'],
    supportedBlendModes: ['normal', 'multiply'],
    supportedOperationTypes: [
      'create-object', 'update-object', 'delete-object', 'move-object', 'resize-object',
      'rotate-object', 'duplicate-object', 'align-objects', 'distribute-objects',
      'group-objects', 'ungroup-objects', 'reorder-object', 'set-visibility',
      'set-lock', 'set-opacity', 'set-blend-mode', 'select-objects', 'rename-object',
    ],
  }
}

function makePlan(operations: AIPlanOperation[]): AIExecutionPlan {
  return {
    id: nanoid(), originalPrompt: 'test', summary: 'test',
    operations, warnings: [], requiresConfirmation: false, createdAt: Date.now(),
  }
}

describe('validatePlan — target existence', () => {
  it('rejects a target that does not exist', () => {
    const plan = makePlan([{ id: nanoid(), type: 'delete-object', targets: [{ objectId: 'missing' }] }])
    const errors = validatePlan(plan, makeContext([]))
    expect(errors.some(e => e.code === 'TARGET_NOT_FOUND' && !e.recoverable)).toBe(true)
  })

  it('accepts a temp ref declared by an earlier operation', () => {
    const plan = makePlan([
      { id: nanoid(), type: 'create-object', objectType: 'rectangle', resultRef: 'r1' },
      { id: nanoid(), type: 'move-object', target: { ref: 'r1' }, toCenter: true },
    ])
    const errors = validatePlan(plan, makeContext([]))
    expect(errors.some(e => e.code === 'TARGET_NOT_FOUND')).toBe(false)
  })

  it('rejects a temp ref that was never declared', () => {
    const plan = makePlan([
      { id: nanoid(), type: 'move-object', target: { ref: 'never-declared' }, toCenter: true },
    ])
    const errors = validatePlan(plan, makeContext([]))
    expect(errors.some(e => e.code === 'TARGET_NOT_FOUND' && !e.recoverable)).toBe(true)
  })
})

describe('validatePlan — locked targets', () => {
  it('flags (recoverably) an operation touching a locked object', () => {
    const locked = makeContextObject({ id: 'l', locked: true })
    const plan = makePlan([{ id: nanoid(), type: 'update-object', target: { objectId: 'l' }, changes: { fill: '#fff' } }])
    const errors = validatePlan(plan, makeContext([locked]))
    const lockedError = errors.find(e => e.code === 'LOCKED_TARGET')
    expect(lockedError).toBeDefined()
    expect(lockedError?.recoverable).toBe(true)
  })

  it('does not flag set-lock itself as touching a locked target', () => {
    const locked = makeContextObject({ id: 'l', locked: true })
    const plan = makePlan([{ id: nanoid(), type: 'set-lock', targets: [{ objectId: 'l' }], locked: false }])
    const errors = validatePlan(plan, makeContext([locked]))
    expect(errors.some(e => e.code === 'LOCKED_TARGET')).toBe(false)
  })
})

describe('validatePlan — numeric ranges', () => {
  it('rejects opacity outside [0,1]', () => {
    const obj = makeContextObject({ id: 'a' })
    const plan = makePlan([{ id: nanoid(), type: 'set-opacity', targets: [{ objectId: 'a' }], opacity: 1.5 }])
    const errors = validatePlan(plan, makeContext([obj]))
    expect(errors.some(e => e.code === 'INVALID_RANGE' && !e.recoverable)).toBe(true)
  })

  it('accepts a valid opacity', () => {
    const obj = makeContextObject({ id: 'a' })
    const plan = makePlan([{ id: nanoid(), type: 'set-opacity', targets: [{ objectId: 'a' }], opacity: 0.5 }])
    const errors = validatePlan(plan, makeContext([obj]))
    expect(errors.some(e => e.code === 'INVALID_RANGE')).toBe(false)
  })

  it('rejects an unsupported blend mode', () => {
    const obj = makeContextObject({ id: 'a' })
    const plan = makePlan([{ id: nanoid(), type: 'set-blend-mode', targets: [{ objectId: 'a' }], blendMode: 'not-a-real-mode' as never }])
    const errors = validatePlan(plan, makeContext([obj]))
    expect(errors.some(e => e.code === 'INVALID_BLEND_MODE' && !e.recoverable)).toBe(true)
  })
})

describe('validatePlan — unsupported operations', () => {
  it('rejects an operation type outside the known set', () => {
    const plan = makePlan([{ id: nanoid(), type: 'delete-everything-forever' as never, targets: [] } as unknown as AIPlanOperation])
    const errors = validatePlan(plan, makeContext([]))
    expect(errors.some(e => e.code === 'UNSUPPORTED_OPERATION' && !e.recoverable)).toBe(true)
  })
})

describe('validatePlan — minimum selection counts (recoverable)', () => {
  it('flags align with fewer than 2 targets', () => {
    const a = makeContextObject({ id: 'a' })
    const plan = makePlan([{ id: nanoid(), type: 'align-objects', targets: [{ objectId: 'a' }], edge: 'left' }])
    const errors = validatePlan(plan, makeContext([a]))
    const err = errors.find(e => e.code === 'INSUFFICIENT_SELECTION')
    expect(err).toBeDefined()
    expect(err?.recoverable).toBe(true)
  })

  it('flags distribute with fewer than 3 targets', () => {
    const a = makeContextObject({ id: 'a' })
    const b = makeContextObject({ id: 'b' })
    const plan = makePlan([{ id: nanoid(), type: 'distribute-objects', targets: [{ objectId: 'a' }, { objectId: 'b' }], axis: 'horizontal' }])
    const errors = validatePlan(plan, makeContext([a, b]))
    expect(errors.some(e => e.code === 'INSUFFICIENT_SELECTION')).toBe(true)
  })
})

describe('validatePlan — ungroup target type', () => {
  it('rejects ungrouping a non-group object', () => {
    const leaf = makeContextObject({ id: 'a', type: 'rectangle' })
    const plan = makePlan([{ id: nanoid(), type: 'ungroup-objects', target: { objectId: 'a' } }])
    const errors = validatePlan(plan, makeContext([leaf]))
    expect(errors.some(e => e.code === 'INVALID_TARGET_TYPE' && !e.recoverable)).toBe(true)
  })
})
