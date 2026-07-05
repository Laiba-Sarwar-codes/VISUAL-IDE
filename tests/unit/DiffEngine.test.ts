// tests/unit/DiffEngine.test.ts
import { describe, it, expect } from 'vitest'
import { computeDiff, computeStats } from '../../src/version-control/DiffEngine'
import { makeObject, resetIdCounter } from './helpers'
import type { Snapshot } from '../../src/version-control/types'

function makeSnapshot(objects: ReturnType<typeof makeObject>[]): Snapshot {
  return { id: 'snap-' + Math.random(), objects, createdAt: Date.now() }
}

beforeEach(() => resetIdCounter())

describe('computeDiff', () => {

  it('detects added objects (null before)', () => {
    const obj = makeObject()
    const after = makeSnapshot([obj])
    const diff = computeDiff(null, after)
    expect(diff.added).toHaveLength(1)
    expect(diff.added[0]?.id).toBe(obj.id)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
  })

  it('detects removed objects', () => {
    const obj = makeObject()
    const before = makeSnapshot([obj])
    const after = makeSnapshot([])
    const diff = computeDiff(before, after)
    expect(diff.removed).toHaveLength(1)
    expect(diff.removed[0]?.id).toBe(obj.id)
    expect(diff.added).toHaveLength(0)
  })

  it('detects modified objects', () => {
    const obj = makeObject({ id: 'obj-1', fill: '#ff0000' })
    const before = makeSnapshot([obj])
    const modified = { ...obj, fill: '#00ff00' }
    const after = makeSnapshot([modified])
    const diff = computeDiff(before, after)
    expect(diff.modified).toHaveLength(1)
    expect(diff.modified[0]?.changedFields).toContain('fill')
  })

  it('detects unchanged objects', () => {
    const obj = makeObject({ id: 'obj-1' })
    const before = makeSnapshot([obj])
    const after = makeSnapshot([{ ...obj }])
    const diff = computeDiff(before, after)
    expect(diff.unchanged).toBe(1)
    expect(diff.modified).toHaveLength(0)
  })

  it('handles empty before and after', () => {
    const diff = computeDiff(makeSnapshot([]), makeSnapshot([]))
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.modified).toHaveLength(0)
    expect(diff.unchanged).toBe(0)
  })

  it('detects multiple changed fields', () => {
    const obj = makeObject({ id: 'obj-1', x: 0, y: 0, fill: '#000' })
    const before = makeSnapshot([obj])
    const after = makeSnapshot([{ ...obj, x: 100, y: 200, fill: '#fff' }])
    const diff = computeDiff(before, after)
    expect(diff.modified[0]?.changedFields).toContain('x')
    expect(diff.modified[0]?.changedFields).toContain('y')
    expect(diff.modified[0]?.changedFields).toContain('fill')
  })

  it('handles mixed adds, removes, and modifications', () => {
    const keep = makeObject({ id: 'keep', x: 0 })
    const remove = makeObject({ id: 'remove' })
    const before = makeSnapshot([keep, remove])
    const added = makeObject({ id: 'added' })
    const modified = { ...keep, x: 999 }
    const after = makeSnapshot([modified, added])
    const diff = computeDiff(before, after)
    expect(diff.added).toHaveLength(1)
    expect(diff.removed).toHaveLength(1)
    expect(diff.modified).toHaveLength(1)
  })
})

describe('computeStats', () => {
  it('returns correct counts', () => {
    const obj = makeObject({ id: 'obj-1' })
    const before = makeSnapshot([obj])
    const newObj = makeObject({ id: 'new' })
    const after = makeSnapshot([{ ...obj, x: 99 }, newObj])
    const stats = computeStats(before, after)
    expect(stats.added).toBe(1)
    expect(stats.removed).toBe(0)
    expect(stats.modified).toBe(1)
  })

  it('all zeros for identical snapshots', () => {
    const obj = makeObject({ id: 'obj-1' })
    const snap = makeSnapshot([obj])
    const stats = computeStats(snap, makeSnapshot([{ ...obj }]))
    expect(stats.added).toBe(0)
    expect(stats.removed).toBe(0)
    expect(stats.modified).toBe(0)
  })
})