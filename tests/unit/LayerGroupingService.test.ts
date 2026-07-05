// tests/unit/LayerGroupingService.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  collectDescendantsAndSelf,
  expandDeletionForGroups,
  groupObjects,
  recomputeGroupBounds,
  ungroupObjects,
} from '../../src/layers/LayerGroupingService'
import { makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('groupObjects', () => {
  it('creates a group containing the selected objects, preserving ids', () => {
    const a = makeObject({ id: 'a', x: 0, y: 0, width: 10, height: 10 })
    const b = makeObject({ id: 'b', x: 20, y: 20, width: 10, height: 10 })
    const { objects, groupId } = groupObjects([a, b], ['a', 'b'])

    expect(groupId).not.toBeNull()
    expect(objects.find(o => o.id === 'a')?.parentId).toBe(groupId)
    expect(objects.find(o => o.id === 'b')?.parentId).toBe(groupId)
    expect(objects.find(o => o.id === 'a')).toBeDefined()
    expect(objects.find(o => o.id === 'b')).toBeDefined()
  })

  it('preserves absolute visual position of grouped children', () => {
    const a = makeObject({ id: 'a', x: 5, y: 7, width: 10, height: 10 })
    const b = makeObject({ id: 'b', x: 20, y: 20, width: 10, height: 10 })
    const { objects } = groupObjects([a, b], ['a', 'b'])
    expect(objects.find(o => o.id === 'a')?.x).toBe(5)
    expect(objects.find(o => o.id === 'a')?.y).toBe(7)
    expect(objects.find(o => o.id === 'b')?.x).toBe(20)
  })

  it('the group bounding box covers all child objects', () => {
    const a = makeObject({ id: 'a', x: 0, y: 0, width: 10, height: 10 })
    const b = makeObject({ id: 'b', x: 20, y: 30, width: 10, height: 10 })
    const { objects, groupId } = groupObjects([a, b], ['a', 'b'])
    const group = objects.find(o => o.id === groupId)!
    expect(group.x).toBe(0)
    expect(group.y).toBe(0)
    expect(group.width).toBe(30) // 20 + 10 - 0
    expect(group.height).toBe(40) // 30 + 10 - 0
  })

  it('excludes locked objects from the group', () => {
    const a = makeObject({ id: 'a' })
    const locked = makeObject({ id: 'locked', locked: true })
    const { objects, groupId } = groupObjects([a, locked], ['a', 'locked'])
    expect(objects.find(o => o.id === 'locked')?.parentId).not.toBe(groupId)
  })

  it('returns no group when nothing eligible is selected', () => {
    const locked = makeObject({ id: 'locked', locked: true })
    const { groupId } = groupObjects([locked], ['locked'])
    expect(groupId).toBeNull()
  })

  it('preserves relative z-order of grouped members', () => {
    const a = makeObject({ id: 'a', zIndex: 5 })
    const b = makeObject({ id: 'b', zIndex: 1 })
    const { objects, groupId } = groupObjects([a, b], ['a', 'b'])
    const children = objects.filter(o => o.parentId === groupId).sort((x, y) => x.zIndex - y.zIndex)
    expect(children.map(o => o.id)).toEqual(['b', 'a']) // b had lower zIndex, stays below a
  })
})

describe('ungroupObjects', () => {
  it('promotes children to the group\'s parent and removes the group, preserving positions', () => {
    const a = makeObject({ id: 'a', x: 5, y: 5 })
    const b = makeObject({ id: 'b', x: 15, y: 15 })
    const { objects: grouped, groupId } = groupObjects([a, b], ['a', 'b'])
    const result = ungroupObjects(grouped, groupId!)

    expect(result.find(o => o.id === groupId)).toBeUndefined()
    expect(result.find(o => o.id === 'a')?.parentId).toBeNull()
    expect(result.find(o => o.id === 'a')?.x).toBe(5)
    expect(result.find(o => o.id === 'b')?.x).toBe(15)
  })

  it('is a no-op for a non-group id', () => {
    const objects = [makeObject({ id: 'a' })]
    const result = ungroupObjects(objects, 'a')
    expect(result).toBe(objects)
  })
})

describe('recomputeGroupBounds', () => {
  it('recomputes the group bbox after a child moves', () => {
    const a = makeObject({ id: 'a', x: 0, y: 0, width: 10, height: 10 })
    const b = makeObject({ id: 'b', x: 20, y: 20, width: 10, height: 10 })
    const { objects, groupId } = groupObjects([a, b], ['a', 'b'])

    const moved = objects.map(o => (o.id === 'b' ? { ...o, x: 100, y: 100 } : o))
    const result = recomputeGroupBounds(moved, groupId!)
    const group = result.find(o => o.id === groupId)!
    expect(group.width).toBe(110) // 100 + 10 - 0
  })
})

describe('collectDescendantsAndSelf / expandDeletionForGroups', () => {
  it('collects all nested descendants of a group', () => {
    const a = makeObject({ id: 'a' })
    const { objects: grouped, groupId } = groupObjects([a], ['a'])
    const nested = makeObject({ id: 'nested', parentId: groupId })
    const ids = collectDescendantsAndSelf([...grouped, nested], groupId!)
    expect([...ids].sort()).toEqual(['a', groupId, 'nested'].sort())
  })

  it('cascades a group delete to include all its descendants', () => {
    const a = makeObject({ id: 'a' })
    const { objects: grouped, groupId } = groupObjects([a], ['a'])
    const expanded = expandDeletionForGroups(grouped, [groupId!])
    expect(expanded.sort()).toEqual([groupId, 'a'].sort())
  })

  it('does not expand deletion for a plain leaf', () => {
    const a = makeObject({ id: 'a' })
    const expanded = expandDeletionForGroups([a], ['a'])
    expect(expanded).toEqual(['a'])
  })
})
