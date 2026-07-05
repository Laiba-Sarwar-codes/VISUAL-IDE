// tests/unit/AIPlanBuilder.test.ts
import { describe, it, expect } from 'vitest'
import { parsePrompt } from '../../src/ai/AIPromptParser'
import { buildPlan } from '../../src/ai/AIPlanBuilder'
import type { AIContextObject, AIEditorContext } from '../../src/ai/planTypes'

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

function makeContext(objects: AIContextObject[], selectedObjectIds: string[] = []): AIEditorContext {
  return {
    objects,
    selectedObjectIds,
    viewport: { left: -800, top: -450, right: 800, bottom: 450 },
    supportedObjectTypes: ['rectangle', 'ellipse', 'text', 'image', 'group', 'folder'],
    supportedBlendModes: ['normal', 'multiply'],
    supportedOperationTypes: [],
  }
}

function plan(prompt: string, context: AIEditorContext = makeContext([])) {
  return buildPlan(parsePrompt(prompt), context, prompt)
}

describe('buildPlan — basic object creation', () => {
  it('builds one create-object operation for a simple prompt', () => {
    const result = plan('Create a red rectangle')
    expect(result.operations).toHaveLength(1)
    expect(result.operations[0]?.type).toBe('create-object')
    expect(result.requiresConfirmation).toBe(false)
  })

  it('builds N create-object operations for a count prompt', () => {
    const result = plan('Create 3 blue rectangles')
    expect(result.operations).toHaveLength(3)
    expect(result.operations.every(op => op.type === 'create-object')).toBe(true)
  })
})

describe('buildPlan — multi-step ordering and temp-ref chaining', () => {
  it('preserves instruction order across steps', () => {
    const result = plan('Create a rectangle, make it blue and center it')
    expect(result.operations.map(op => op.type)).toEqual(['create-object', 'update-object', 'move-object'])
  })

  it('resolves "it" to the just-created object via a temp ref, not a real object id', () => {
    const result = plan('Create a rectangle, make it blue and center it')
    const create = result.operations[0]
    const update = result.operations[1]
    expect(create?.type).toBe('create-object')
    expect(create && 'resultRef' in create ? create.resultRef : undefined).toBeDefined()
    expect(update?.type).toBe('update-object')
    if (update?.type === 'update-object') {
      expect(update.target.ref).toBe(create && 'resultRef' in create ? create.resultRef : undefined)
      expect(update.target.objectId).toBeUndefined()
    }
  })

  it('resolves "the copy" after a duplicate step to the duplicate\'s temp ref', () => {
    const context = makeContext([makeContextObject({ id: 'a' })], ['a'])
    const result = buildPlan(parsePrompt('Duplicate the selected object and move the copy right'), context, 'x')
    expect(result.operations.map(op => op.type)).toEqual(['duplicate-object', 'move-object'])
    const duplicate = result.operations[0]
    const move = result.operations[1]
    if (duplicate?.type === 'duplicate-object' && move?.type === 'move-object') {
      expect(move.target.ref).toBe(duplicate.resultRef)
    }
  })

  it('chains "them" across select -> align -> distribute', () => {
    const circles = [
      makeContextObject({ id: 'c1', type: 'ellipse', zIndex: 0 }),
      makeContextObject({ id: 'c2', type: 'ellipse', zIndex: 1 }),
      makeContextObject({ id: 'c3', type: 'ellipse', zIndex: 2 }),
    ]
    const context = makeContext(circles)
    const result = buildPlan(
      parsePrompt('Select all circles, align them at the top and distribute them horizontally'),
      context,
      'x'
    )
    expect(result.operations.map(op => op.type)).toEqual(['select-objects', 'align-objects', 'distribute-objects'])
    const select = result.operations[0]
    const align = result.operations[1]
    const distribute = result.operations[2]
    if (select?.type === 'select-objects' && align?.type === 'align-objects' && distribute?.type === 'distribute-objects') {
      expect(align.targets.map(t => t.objectId).sort()).toEqual(select.targets.map(t => t.objectId).sort())
      expect(distribute.targets.map(t => t.objectId).sort()).toEqual(select.targets.map(t => t.objectId).sort())
    }
  })
})

describe('buildPlan — destructive operation confirmation', () => {
  it('requires confirmation when deleting more than one object', () => {
    const a = makeContextObject({ id: 'a' })
    const b = makeContextObject({ id: 'b' })
    const context = makeContext([a, b])
    const result = buildPlan(parsePrompt('Delete all objects'), context, 'x')
    expect(result.requiresConfirmation).toBe(true)
  })

  it('requires confirmation when a plan touches a locked object', () => {
    const locked = makeContextObject({ id: 'l', locked: true, name: 'Locked Thing' })
    const context = makeContext([locked], ['l'])
    const result = buildPlan(parsePrompt('Change color to red'), context, 'x')
    expect(result.requiresConfirmation).toBe(true)
  })

  it('does not require confirmation for a simple, unambiguous create', () => {
    const result = plan('Create a red rectangle')
    expect(result.requiresConfirmation).toBe(false)
  })
})

describe('buildPlan — ambiguous/missing references produce warnings, not silent guesses', () => {
  it('warns instead of silently deleting when no object is selected', () => {
    const result = plan('Delete selected object')
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.requiresConfirmation).toBe(true)
  })

  it('warns when rename has no new name', () => {
    const context = makeContext([makeContextObject({ id: 'a' })], ['a'])
    const result = buildPlan(parsePrompt('Rename the selected layer'), context, 'x')
    expect(result.warnings.some(w => /requires a new name/i.test(w))).toBe(true)
    expect(result.operations.some(op => op.type === 'rename-object')).toBe(false)
  })
})

describe('buildPlan — unsupported/unknown instruction', () => {
  it('produces no operations and a warning for unrecognized text', () => {
    const result = plan('asdkjfh qwoeiru')
    expect(result.operations).toHaveLength(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})
