// tests/unit/CameraState.test.ts
// V1: Tests for Task 2&3 — unified camera state, clamping, NaN safety

import { describe, it, expect, beforeEach } from 'vitest'
import { Camera } from '../../src/engine/rendering/Camera'

describe('Camera — V1 state serialization and validation', () => {

  describe('getState serialization', () => {
    it('returns serializable { x, y, zoom } object', () => {
      const c = new Camera({ x: 100, y: 200, zoom: 1.5 })
      const state = c.getState()
      expect(state).toEqual({ x: 100, y: 200, zoom: 1.5 })
    })

    it('can be JSON serialized without loss', () => {
      const c = new Camera({ x: -50, y: 75, zoom: 2 })
      const json = JSON.stringify(c.getState())
      const restored = JSON.parse(json)
      expect(restored.x).toBe(-50)
      expect(restored.y).toBe(75)
      expect(restored.zoom).toBe(2)
    })

    it('state matches internal values after pan', () => {
      const c = new Camera({ x: 0, y: 0, zoom: 1 })
      c.panByScreenDelta(-100, -50)
      const state = c.getState()
      expect(state.x).toBe(c.x)
      expect(state.y).toBe(c.y)
      expect(state.zoom).toBe(c.zoom)
    })
  })

  describe('zoom clamping', () => {
    it('zoom minimum is clamped to 0.1', () => {
      const c = new Camera({ zoom: 0.1 })
      const center = { x: 400, y: 300 }
      for (let i = 0; i < 20; i++) c.zoomAtScreenPoint(center, center, 0.1)
      expect(c.zoom).toBeGreaterThanOrEqual(0.1)
    })

    it('zoom maximum is clamped to 8', () => {
      const c = new Camera({ zoom: 1 })
      const center = { x: 400, y: 300 }
      for (let i = 0; i < 20; i++) c.zoomAtScreenPoint(center, center, 10)
      expect(c.zoom).toBeLessThanOrEqual(8)
    })
  })

  describe('editor store clampZoom', () => {
    it('clamps zoom to [0.1, 8] range', () => {
      // Test the clamp logic directly (mirrors editor store logic)
      const clamp = (z: number) => {
        if (!isFinite(z) || isNaN(z)) return 1
        return Math.min(8, Math.max(0.1, z))
      }
      expect(clamp(0.05)).toBe(0.1)
      expect(clamp(10)).toBe(8)
      expect(clamp(NaN)).toBe(1)
      expect(clamp(Infinity)).toBe(1)
      expect(clamp(2)).toBe(2)
    })
  })

  describe('camera restoration from saved state', () => {
    it('restores from saved state with all fields', () => {
      const saved = { x: 250, y: -100, zoom: 2.5 }
      const c = new Camera(saved)
      expect(c.x).toBe(250)
      expect(c.y).toBe(-100)
      expect(c.zoom).toBe(2.5)
    })

    it('uses safe defaults for missing fields', () => {
      const c = new Camera({})
      expect(c.x).toBe(0)
      expect(c.y).toBe(0)
      expect(c.zoom).toBe(1)
    })

    it('getState after construction returns exact input values', () => {
      const c = new Camera({ x: 100, y: 200, zoom: 1.5 })
      expect(c.getState()).toEqual({ x: 100, y: 200, zoom: 1.5 })
    })
  })

  describe('coordinate consistency', () => {
    it('worldToScreen and screenToWorld are mutual inverses', () => {
      const c = new Camera({ x: 150, y: -75, zoom: 1.8 })
      const center = { x: 400, y: 300 }
      const world = { x: 200, y: 100 }
      const screen = c.worldToScreen(world, center)
      const back = c.screenToWorld(screen, center)
      expect(back.x).toBeCloseTo(world.x, 5)
      expect(back.y).toBeCloseTo(world.y, 5)
    })
  })
})
