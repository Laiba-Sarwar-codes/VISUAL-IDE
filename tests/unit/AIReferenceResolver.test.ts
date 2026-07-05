// tests/unit/AIReferenceResolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveReference } from '../../src/ai/AIReferenceResolver'
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

describe('resolveReference — selected/current', () => {
  it('resolves "selected" to the current selection', () => {
    const context = makeContext([makeContextObject({ id: 'a' })], ['a'])
    expect(resolveReference('selected object', context).ids).toEqual(['a'])
  })

  it('warns when nothing is selected', () => {
    const context = makeContext([makeContextObject({ id: 'a' })], [])
    const result = resolveReference('the selected object', context)
    expect(result.ids).toEqual([])
    expect(result.warning).toMatch(/no object is currently selected/i)
  })
})

describe('resolveReference — named objects', () => {
  it('resolves "named X"', () => {
    const context = makeContext([makeContextObject({ id: 'a', name: 'Header' })])
    expect(resolveReference('object named Header', context).ids).toEqual(['a'])
  })

  it('resolves a bare name like "the logo" without an explicit "named" keyword', () => {
    const context = makeContext([makeContextObject({ id: 'a', name: 'Logo' })])
    expect(resolveReference('the logo', context).ids).toEqual(['a'])
  })

  it('warns when no object has the given name', () => {
    const context = makeContext([makeContextObject({ id: 'a', name: 'Header' })])
    const result = resolveReference('object named Nonexistent', context)
    expect(result.ids).toEqual([])
    expect(result.warning).toMatch(/no object named/i)
  })
})

describe('resolveReference — ordinal references', () => {
  it('resolves "first rectangle" / "second rectangle" / "last rectangle" by z-order', () => {
    const a = makeContextObject({ id: 'a', zIndex: 0 })
    const b = makeContextObject({ id: 'b', zIndex: 1 })
    const c = makeContextObject({ id: 'c', zIndex: 2 })
    const context = makeContext([a, b, c])
    expect(resolveReference('the first rectangle', context).ids).toEqual(['a'])
    expect(resolveReference('the second rectangle', context).ids).toEqual(['b'])
    expect(resolveReference('the last rectangle', context).ids).toEqual(['c'])
  })

  it('warns when the ordinal exceeds the available count', () => {
    const context = makeContext([makeContextObject({ id: 'a' })])
    const result = resolveReference('the second rectangle', context)
    expect(result.ids).toEqual([])
    expect(result.warning).toMatch(/no second matching object/i)
  })
})

describe('resolveReference — largest/smallest', () => {
  it('resolves "largest rectangle"', () => {
    const small = makeContextObject({ id: 'small', width: 10, height: 10 })
    const large = makeContextObject({ id: 'large', width: 200, height: 200 })
    const context = makeContext([small, large])
    expect(resolveReference('the largest rectangle', context).ids).toEqual(['large'])
  })

  it('resolves "smallest object"', () => {
    const small = makeContextObject({ id: 'small', width: 10, height: 10 })
    const large = makeContextObject({ id: 'large', width: 200, height: 200 })
    const context = makeContext([small, large])
    expect(resolveReference('the smallest object', context).ids).toEqual(['small'])
  })
})

describe('resolveReference — bulk references', () => {
  it('resolves "all circles"', () => {
    const circle = makeContextObject({ id: 'c1', type: 'ellipse' })
    const rect = makeContextObject({ id: 'r1', type: 'rectangle' })
    const context = makeContext([circle, rect])
    expect(resolveReference('all circles', context).ids).toEqual(['c1'])
  })

  it('resolves "all visible objects"', () => {
    const visible = makeContextObject({ id: 'v', visible: true })
    const hidden = makeContextObject({ id: 'h', visible: false })
    const context = makeContext([visible, hidden])
    expect(resolveReference('all visible objects', context).ids).toEqual(['v'])
  })

  it('resolves "all unlocked objects"', () => {
    const unlocked = makeContextObject({ id: 'u', locked: false })
    const locked = makeContextObject({ id: 'l', locked: true })
    const context = makeContext([unlocked, locked])
    expect(resolveReference('all unlocked objects', context).ids).toEqual(['u'])
  })

  it('resolves objects inside the current viewport', () => {
    const inside = makeContextObject({ id: 'in', x: 0, y: 0, width: 10, height: 10 })
    const outside = makeContextObject({ id: 'out', x: 5000, y: 5000, width: 10, height: 10 })
    const context = makeContext([inside, outside])
    expect(resolveReference('objects inside the current viewport', context).ids).toEqual(['in'])
  })
})

describe('resolveReference — ambiguity and missing targets', () => {
  it('returns a warning (not a silent guess) for an ambiguous bare-type reference with multiple matches', () => {
    const a = makeContextObject({ id: 'a', type: 'rectangle' })
    const b = makeContextObject({ id: 'b', type: 'rectangle' })
    const context = makeContext([a, b])
    const result = resolveReference('the rectangle', context)
    expect(result.ids.sort()).toEqual(['a', 'b'])
    expect(result.warning).toMatch(/ambiguous/i)
  })

  it('returns an empty result with a warning when nothing matches at all', () => {
    const context = makeContext([])
    const result = resolveReference('the rectangle', context)
    expect(result.ids).toEqual([])
    expect(result.warning).toBeDefined()
  })
})
