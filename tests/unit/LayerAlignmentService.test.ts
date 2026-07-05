// tests/unit/LayerAlignmentService.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  alignBottom,
  alignHCenter,
  alignLeft,
  alignRight,
  alignTop,
  alignVCenter,
  distributeHorizontal,
  distributeVertical,
} from '../../src/layers/LayerAlignmentService'
import { makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('align*', () => {
  it('alignLeft moves all objects to the leftmost x', () => {
    const a = makeObject({ id: 'a', x: 10, width: 10 })
    const b = makeObject({ id: 'b', x: 50, width: 10 })
    const result = alignLeft([a, b], ['a', 'b'])
    expect(result.find(o => o.id === 'a')?.x).toBe(10)
    expect(result.find(o => o.id === 'b')?.x).toBe(10)
  })

  it('alignRight aligns right edges', () => {
    const a = makeObject({ id: 'a', x: 0, width: 10 }) // right edge 10
    const b = makeObject({ id: 'b', x: 50, width: 20 }) // right edge 70
    const result = alignRight([a, b], ['a', 'b'])
    expect(result.find(o => o.id === 'a')?.x).toBe(60) // 70 - 10
    expect(result.find(o => o.id === 'b')?.x).toBe(50) // unchanged, already at max right
  })

  it('alignHCenter centers on the collective bounds midpoint', () => {
    const a = makeObject({ id: 'a', x: 0, width: 10 })
    const b = makeObject({ id: 'b', x: 90, width: 10 }) // collective bounds [0,100], center 50
    const result = alignHCenter([a, b], ['a', 'b'])
    expect(result.find(o => o.id === 'a')?.x).toBe(45) // 50 - 5
    expect(result.find(o => o.id === 'b')?.x).toBe(45)
  })

  it('alignTop/alignBottom/alignVCenter mirror the horizontal versions on y', () => {
    const a = makeObject({ id: 'a', y: 0, height: 10 })
    const b = makeObject({ id: 'b', y: 40, height: 20 })
    expect(alignTop([a, b], ['a', 'b']).find(o => o.id === 'b')?.y).toBe(0)
    expect(alignBottom([a, b], ['a', 'b']).find(o => o.id === 'a')?.y).toBe(50) // bottom=60, 60-10
    expect(alignVCenter([a, b], ['a', 'b']).find(o => o.id === 'a')?.y).toBe(25) // center=30, 30-5
  })

  it('does not move locked objects, and excludes them from the collective bounds', () => {
    const a = makeObject({ id: 'a', x: 10, width: 10 })
    const locked = makeObject({ id: 'locked', x: 500, width: 10, locked: true })
    const result = alignLeft([a, locked], ['a', 'locked'])
    expect(result.find(o => o.id === 'locked')?.x).toBe(500) // untouched
    expect(result.find(o => o.id === 'a')?.x).toBe(10) // bounds computed from 'a' alone -> no-op move
  })

  it('is a no-op with fewer than 2 eligible objects', () => {
    const a = makeObject({ id: 'a', x: 10 })
    const objects = [a]
    const result = alignLeft(objects, ['a'])
    expect(result).toBe(objects)
  })
})

describe('distributeHorizontal / distributeVertical', () => {
  it('requires at least 3 objects (no-op otherwise)', () => {
    const a = makeObject({ id: 'a', x: 0, width: 10 })
    const b = makeObject({ id: 'b', x: 100, width: 10 })
    const objects = [a, b]
    const result = distributeHorizontal(objects, ['a', 'b'])
    expect(result).toBe(objects)
  })

  it('equalizes horizontal gaps while preserving the outermost objects', () => {
    const a = makeObject({ id: 'a', x: 0, width: 10 })
    const b = makeObject({ id: 'b', x: 40, width: 10 })
    const c = makeObject({ id: 'c', x: 100, width: 10 })
    const result = distributeHorizontal([a, b, c], ['a', 'b', 'c'])

    // outermost preserved
    expect(result.find(o => o.id === 'a')?.x).toBe(0)
    expect(result.find(o => o.id === 'c')?.x).toBe(100)
    // span 110, total width 30, gap = (110-30)/2 = 40 -> b.x = a.x + a.width + gap = 0 + 10 + 40
    expect(result.find(o => o.id === 'b')?.x).toBe(50)
  })

  it('handles zero-sized objects without producing NaN', () => {
    const a = makeObject({ id: 'a', x: 0, width: 0 })
    const b = makeObject({ id: 'b', x: 50, width: 0 })
    const c = makeObject({ id: 'c', x: 100, width: 0 })
    const result = distributeHorizontal([a, b, c], ['a', 'b', 'c'])
    expect(result.every(o => Number.isFinite(o.x))).toBe(true)
  })

  it('distributeVertical mirrors distributeHorizontal on the y axis', () => {
    const a = makeObject({ id: 'a', y: 0, height: 10 })
    const b = makeObject({ id: 'b', y: 40, height: 10 })
    const c = makeObject({ id: 'c', y: 100, height: 10 })
    const result = distributeVertical([a, b, c], ['a', 'b', 'c'])
    expect(result.find(o => o.id === 'a')?.y).toBe(0)
    expect(result.find(o => o.id === 'c')?.y).toBe(100)
  })
})
