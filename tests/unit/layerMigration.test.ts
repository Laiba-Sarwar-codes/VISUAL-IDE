// tests/unit/layerMigration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { normalizeHierarchy } from '../../src/layers/layerMigration'
import { makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('normalizeHierarchy', () => {
  it('fills missing parentId with null (flat/legacy project migration)', () => {
    const objects = [makeObject({ id: 'a' }), makeObject({ id: 'b' })]
    const result = normalizeHierarchy(objects)
    expect(result.every(o => o.parentId === null)).toBe(true)
  })

  it('leaves valid parent/child relationships untouched', () => {
    const parent = makeObject({ id: 'p', type: 'folder' })
    const child = makeObject({ id: 'c', parentId: 'p' })
    const result = normalizeHierarchy([parent, child])
    expect(result.find(o => o.id === 'c')?.parentId).toBe('p')
  })

  it('resets a dangling parentId (parent does not exist) to root', () => {
    const child = makeObject({ id: 'c', parentId: 'does-not-exist' })
    const result = normalizeHierarchy([child])
    expect(result[0]?.parentId).toBeNull()
  })

  it('breaks a direct circular reference (a -> b -> a)', () => {
    const a = makeObject({ id: 'a', parentId: 'b' })
    const b = makeObject({ id: 'b', parentId: 'a' })
    const result = normalizeHierarchy([a, b])
    expect(result.every(o => o.parentId === null)).toBe(true)
  })

  it('breaks a self-referencing node (a -> a)', () => {
    const a = makeObject({ id: 'a', parentId: 'a' })
    const result = normalizeHierarchy([a])
    expect(result[0]?.parentId).toBeNull()
  })

  it('is idempotent — running twice yields the same result', () => {
    const a = makeObject({ id: 'a', parentId: 'b' })
    const b = makeObject({ id: 'b', parentId: 'a' })
    const once = normalizeHierarchy([a, b])
    const twice = normalizeHierarchy(once)
    expect(twice).toEqual(once)
  })

  it('preserves a deep valid chain (grandparent -> parent -> child)', () => {
    const gp = makeObject({ id: 'gp', type: 'folder' })
    const p = makeObject({ id: 'p', type: 'group', parentId: 'gp' })
    const c = makeObject({ id: 'c', parentId: 'p' })
    const result = normalizeHierarchy([gp, p, c])
    expect(result.find(o => o.id === 'p')?.parentId).toBe('gp')
    expect(result.find(o => o.id === 'c')?.parentId).toBe('p')
  })
})
