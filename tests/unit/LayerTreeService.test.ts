// tests/unit/LayerTreeService.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildPaintOrder,
  buildTree,
  flattenVisible,
  getEffectiveBlendMode,
  getEffectiveLocked,
  getEffectiveOpacity,
  getEffectiveVisibility,
  getOutermostGroup,
} from '../../src/layers/LayerTreeService'
import { makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('buildTree', () => {
  it('builds root nodes for objects with no parent', () => {
    const a = makeObject({ id: 'a' })
    const b = makeObject({ id: 'b' })
    const tree = buildTree([a, b])
    expect(tree.map(n => n.id).sort()).toEqual(['a', 'b'])
  })

  it('nests children under their parent folder', () => {
    const folder = makeObject({ id: 'folder', type: 'folder' })
    const child = makeObject({ id: 'child', parentId: 'folder' })
    const tree = buildTree([folder, child])
    expect(tree).toHaveLength(1)
    expect(tree[0]?.children.map(c => c.id)).toEqual(['child'])
  })

  it('marks folder/group nodes with the correct kind', () => {
    const folder = makeObject({ id: 'f', type: 'folder' })
    const group = makeObject({ id: 'g', type: 'group' })
    const leaf = makeObject({ id: 'l' })
    const tree = buildTree([folder, group, leaf])
    expect(tree.find(n => n.id === 'f')?.kind).toBe('folder')
    expect(tree.find(n => n.id === 'g')?.kind).toBe('group')
    expect(tree.find(n => n.id === 'l')?.kind).toBe('leaf')
  })
})

describe('buildPaintOrder', () => {
  it('returns only leaf ids, excluding folders/groups', () => {
    const folder = makeObject({ id: 'folder', type: 'folder' })
    const leaf = makeObject({ id: 'leaf', parentId: 'folder' })
    const order = buildPaintOrder([folder, leaf])
    expect(order).toEqual(['leaf'])
  })

  it('orders a group\'s children within its own z-slot among siblings', () => {
    const rootA = makeObject({ id: 'rootA', zIndex: 0 })
    const group = makeObject({ id: 'group', type: 'group', zIndex: 1 })
    const child = makeObject({ id: 'child', parentId: 'group', zIndex: 0 })
    const rootB = makeObject({ id: 'rootB', zIndex: 2 })
    const order = buildPaintOrder([rootA, group, child, rootB])
    expect(order).toEqual(['rootA', 'child', 'rootB'])
  })
})

describe('flattenVisible', () => {
  it('excludes descendants of a collapsed folder', () => {
    const folder = makeObject({ id: 'folder', type: 'folder', expanded: false })
    const child = makeObject({ id: 'child', parentId: 'folder' })
    const order = flattenVisible([folder, child])
    expect(order).toContain('folder')
    expect(order).not.toContain('child')
  })

  it('includes descendants of an expanded folder', () => {
    const folder = makeObject({ id: 'folder', type: 'folder', expanded: true })
    const child = makeObject({ id: 'child', parentId: 'folder' })
    const order = flattenVisible([folder, child])
    expect(order).toContain('child')
  })
})

describe('effective property resolution', () => {
  it('inherited visibility: any hidden ancestor hides the descendant', () => {
    const folder = makeObject({ id: 'folder', type: 'folder', visible: false })
    const child = makeObject({ id: 'child', parentId: 'folder', visible: true })
    const objects = [folder, child]
    expect(getEffectiveVisibility(objects, 'child')).toBe(false)
  })

  it('inherited locking: any locked ancestor locks the descendant', () => {
    const group = makeObject({ id: 'group', type: 'group', locked: true })
    const child = makeObject({ id: 'child', parentId: 'group', locked: false })
    const objects = [group, child]
    expect(getEffectiveLocked(objects, 'child')).toBe(true)
  })

  it('effective opacity multiplies through the ancestor chain, clamped [0,1]', () => {
    const grandparent = makeObject({ id: 'gp', type: 'folder', opacity: 0.5 })
    const parent = makeObject({ id: 'p', type: 'group', parentId: 'gp', opacity: 0.5 })
    const child = makeObject({ id: 'c', parentId: 'p', opacity: 1 })
    const objects = [grandparent, parent, child]
    expect(getEffectiveOpacity(objects, 'c')).toBeCloseTo(0.25)
  })

  it('does not mutate the child\'s own stored opacity', () => {
    const parent = makeObject({ id: 'p', type: 'group', opacity: 0.5 })
    const child = makeObject({ id: 'c', parentId: 'p', opacity: 1 })
    const objects = [parent, child]
    getEffectiveOpacity(objects, 'c')
    expect(child.opacity).toBe(1)
  })

  it('blend mode: falls back to the nearest ancestor\'s defined blend mode', () => {
    const group = makeObject({ id: 'g', type: 'group', blendMode: 'multiply' })
    const child = makeObject({ id: 'c', parentId: 'g' })
    const objects = [group, child]
    expect(getEffectiveBlendMode(objects, 'c')).toBe('multiply')
  })

  it('blend mode: a leaf\'s own blend mode takes priority over an ancestor\'s', () => {
    const group = makeObject({ id: 'g', type: 'group', blendMode: 'multiply' })
    const child = makeObject({ id: 'c', parentId: 'g', blendMode: 'screen' })
    const objects = [group, child]
    expect(getEffectiveBlendMode(objects, 'c')).toBe('screen')
  })
})

describe('getOutermostGroup', () => {
  it('returns the topmost group ancestor for a nested leaf', () => {
    const outer = makeObject({ id: 'outer', type: 'group' })
    const inner = makeObject({ id: 'inner', type: 'group', parentId: 'outer' })
    const leaf = makeObject({ id: 'leaf', parentId: 'inner' })
    const objects = [outer, inner, leaf]
    expect(getOutermostGroup(objects, 'leaf')).toBe('outer')
  })

  it('returns null when there is no group ancestor', () => {
    const leaf = makeObject({ id: 'leaf' })
    expect(getOutermostGroup([leaf], 'leaf')).toBeNull()
  })

  it('does not treat a folder ancestor as a group', () => {
    const folder = makeObject({ id: 'folder', type: 'folder' })
    const leaf = makeObject({ id: 'leaf', parentId: 'folder' })
    const objects = [folder, leaf]
    expect(getOutermostGroup(objects, 'leaf')).toBeNull()
  })
})
