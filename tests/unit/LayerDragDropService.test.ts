// tests/unit/LayerDragDropService.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { computeDrop, computeDropToRoot } from '../../src/layers/LayerDragDropService'
import { makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('computeDrop', () => {
  it('rejects dropping an item onto itself', () => {
    const a = makeObject({ id: 'a' })
    expect(computeDrop([a], 'a', 'a', 'before')).toBeNull()
  })

  it('rejects an unknown dragged or target id', () => {
    const a = makeObject({ id: 'a' })
    expect(computeDrop([a], 'missing', 'a', 'before')).toBeNull()
    expect(computeDrop([a], 'a', 'missing', 'before')).toBeNull()
  })

  it('moves an item inside a folder', () => {
    const folder = makeObject({ id: 'folder', type: 'folder' })
    const item = makeObject({ id: 'item' })
    const result = computeDrop([folder, item], 'item', 'folder', 'inside')
    expect(result?.find(o => o.id === 'item')?.parentId).toBe('folder')
  })

  it('rejects dropping "inside" a leaf object (not a container)', () => {
    const leaf = makeObject({ id: 'leaf' })
    const item = makeObject({ id: 'item' })
    expect(computeDrop([leaf, item], 'item', 'leaf', 'inside')).toBeNull()
  })

  it('rejects a drop that would create a circular nesting', () => {
    const parentGroup = makeObject({ id: 'parent', type: 'group' })
    const childGroup = makeObject({ id: 'child', type: 'group', parentId: 'parent' })
    expect(computeDrop([parentGroup, childGroup], 'parent', 'child', 'inside')).toBeNull()
  })

  it('reorders siblings via before/after (panel-visual "before" = higher zIndex, see service docstring)', () => {
    const a = makeObject({ id: 'a', zIndex: 0 })
    const b = makeObject({ id: 'b', zIndex: 1 })
    const c = makeObject({ id: 'c', zIndex: 2 })
    const result = computeDrop([a, b, c], 'a', 'b', 'before')
    expect(result).not.toBeNull()
    const sorted = [...result!].sort((x, y) => x.zIndex - y.zIndex)
    expect(sorted.map(o => o.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('computeDropToRoot', () => {
  it('moves a nested item back to root', () => {
    const folder = makeObject({ id: 'folder', type: 'folder' })
    const item = makeObject({ id: 'item', parentId: 'folder' })
    const result = computeDropToRoot([folder, item], 'item')
    expect(result?.find(o => o.id === 'item')?.parentId).toBeNull()
  })

  it('is a no-op for an item already at root', () => {
    const item = makeObject({ id: 'item' })
    expect(computeDropToRoot([item], 'item')).toBeNull()
  })
})
