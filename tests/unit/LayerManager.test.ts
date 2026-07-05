// tests/unit/LayerManager.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { LayerManager } from '../../src/engine/layers/LayerManager'
import { makeObjects, makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('LayerManager', () => {

  describe('normalize', () => {
    it('assigns sequential zIndex values starting at 0', () => {
      const objects = makeObjects(3)
      const result = LayerManager.normalize(objects)
      expect(result.map(o => o.zIndex)).toEqual([0, 1, 2])
    })

    it('sorts by existing zIndex before normalizing', () => {
      const a = makeObject({ id: 'a', zIndex: 10 })
      const b = makeObject({ id: 'b', zIndex: 2 })
      const c = makeObject({ id: 'c', zIndex: 5 })
      const result = LayerManager.normalize([a, b, c])
      expect(result[0]?.id).toBe('b')
      expect(result[1]?.id).toBe('c')
      expect(result[2]?.id).toBe('a')
    })

    it('handles single object', () => {
      const result = LayerManager.normalize([makeObject({ zIndex: 99 })])
      expect(result[0]?.zIndex).toBe(0)
    })

    it('handles empty array', () => {
      expect(LayerManager.normalize([])).toEqual([])
    })
  })

  describe('bringForward', () => {
    it('increases zIndex of target object', () => {
      const objects = makeObjects(3)
      const id = objects[0]!.id
      const result = LayerManager.bringForward(objects, id)
      const moved = result.find(o => o.id === id)
      expect(moved?.zIndex).toBeGreaterThan(0)
    })

    it('does not change order of top object', () => {
      const objects = makeObjects(3)
      const topId = objects[2]!.id
      const result = LayerManager.bringForward(objects, topId)
      const top = result.find(o => o.id === topId)
      expect(top?.zIndex).toBe(2)
    })

    it('swaps with the object above', () => {
      const a = makeObject({ id: 'a', zIndex: 0 })
      const b = makeObject({ id: 'b', zIndex: 1 })
      const result = LayerManager.bringForward([a, b], 'a')
      const movedA = result.find(o => o.id === 'a')
      const movedB = result.find(o => o.id === 'b')
      expect(movedA?.zIndex).toBeGreaterThan(movedB?.zIndex ?? 99)
    })

    it('returns original array when id not found', () => {
      const objects = makeObjects(2)
      const result = LayerManager.bringForward(objects, 'nonexistent')
      expect(result).toEqual(objects)
    })
  })

  describe('sendBackward', () => {
    it('decreases zIndex of target object', () => {
      const objects = makeObjects(3)
      const id = objects[2]!.id
      const result = LayerManager.sendBackward(objects, id)
      const moved = result.find(o => o.id === id)
      expect(moved?.zIndex).toBeLessThan(2)
    })

    it('does not change order of bottom object', () => {
      const objects = makeObjects(3)
      const bottomId = objects[0]!.id
      const result = LayerManager.sendBackward(objects, bottomId)
      const bottom = result.find(o => o.id === bottomId)
      expect(bottom?.zIndex).toBe(0)
    })

    it('swaps with the object below', () => {
      const a = makeObject({ id: 'a', zIndex: 0 })
      const b = makeObject({ id: 'b', zIndex: 1 })
      const result = LayerManager.sendBackward([a, b], 'b')
      const movedA = result.find(o => o.id === 'a')
      const movedB = result.find(o => o.id === 'b')
      expect(movedB?.zIndex).toBeLessThan(movedA?.zIndex ?? -1)
    })
  })

  describe('bringToFront', () => {
    it('gives target object highest zIndex', () => {
      // Use a middle object (index 1) so it actually moves
      const objects = makeObjects(4)
      const id = objects[1]!.id   // zIndex 1 — not already at top
      const result = LayerManager.bringToFront(objects, id)
      const moved = result.find(o => o.id === id)
      const maxZ = Math.max(...result.map(o => o.zIndex))
      expect(moved?.zIndex).toBe(maxZ)
    })

    it('does not affect top object', () => {
      const objects = makeObjects(3)
      const topId = objects[2]!.id
      const before = objects.find(o => o.id === topId)?.zIndex
      const result = LayerManager.bringToFront(objects, topId)
      const after = result.find(o => o.id === topId)?.zIndex
      expect(after).toBe(before)
    })

    it('all other objects have lower zIndex than moved object', () => {
      const objects = makeObjects(4)
      const id = objects[0]!.id
      const result = LayerManager.bringToFront(objects, id)
      const moved = result.find(o => o.id === id)!
      const others = result.filter(o => o.id !== id)
      expect(others.every(o => o.zIndex < moved.zIndex)).toBe(true)
    })

    it('returns original when id not found', () => {
      const objects = makeObjects(2)
      const result = LayerManager.bringToFront(objects, 'missing')
      expect(result).toEqual(objects)
    })
  })

  describe('sendToBack', () => {
    it('gives target object lowest zIndex', () => {
      // Use a middle object (index 2) so it actually moves
      const objects = makeObjects(4)
      const id = objects[2]!.id   // zIndex 2 — not already at bottom
      const result = LayerManager.sendToBack(objects, id)
      const moved = result.find(o => o.id === id)
      const minZ = Math.min(...result.map(o => o.zIndex))
      expect(moved?.zIndex).toBe(minZ)
    })

    it('does not affect bottom object', () => {
      const objects = makeObjects(3)
      const bottomId = objects[0]!.id
      const result = LayerManager.sendToBack(objects, bottomId)
      const moved = result.find(o => o.id === bottomId)
      expect(moved?.zIndex).toBe(0)
    })

    it('all other objects have higher zIndex than moved object', () => {
      const objects = makeObjects(4)
      const id = objects[3]!.id
      const result = LayerManager.sendToBack(objects, id)
      const moved = result.find(o => o.id === id)!
      const others = result.filter(o => o.id !== id)
      expect(others.every(o => o.zIndex > moved.zIndex)).toBe(true)
    })

    it('returns original when id not found', () => {
      const objects = makeObjects(2)
      const result = LayerManager.sendToBack(objects, 'missing')
      expect(result).toEqual(objects)
    })
  })
})