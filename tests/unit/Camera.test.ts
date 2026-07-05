// tests/unit/Camera.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { Camera } from '../../src/engine/rendering/Camera'

describe('Camera', () => {
  let camera: Camera

  beforeEach(() => {
    camera = new Camera({ x: 0, y: 0, zoom: 1 })
  })

  // ── Constructor ────────────────────────────────────────────────────

  describe('constructor', () => {
    it('defaults to x=0, y=0, zoom=1', () => {
      const c = new Camera()
      expect(c.x).toBe(0)
      expect(c.y).toBe(0)
      expect(c.zoom).toBe(1)
    })

    it('accepts initial state', () => {
      const c = new Camera({ x: 100, y: 200, zoom: 2 })
      expect(c.x).toBe(100)
      expect(c.y).toBe(200)
      expect(c.zoom).toBe(2)
    })

    it('accepts partial initial state', () => {
      const c = new Camera({ zoom: 0.5 })
      expect(c.x).toBe(0)
      expect(c.y).toBe(0)
      expect(c.zoom).toBe(0.5)
    })
  })

  // ── getState ───────────────────────────────────────────────────────

  describe('getState', () => {
    it('returns current x, y, zoom', () => {
      const state = camera.getState()
      expect(state).toEqual({ x: 0, y: 0, zoom: 1 })
    })

    it('reflects updated state after pan', () => {
      camera.panByScreenDelta(-100, 0)
      const state = camera.getState()
      expect(state.x).toBeGreaterThan(0)
    })
  })

  // ── Pan ────────────────────────────────────────────────────────────

  describe('panByScreenDelta', () => {
    it('moves camera right when dragging left (dx negative)', () => {
      camera.panByScreenDelta(-100, 0)
      expect(camera.x).toBeGreaterThan(0)
    })

    it('moves camera left when dragging right (dx positive)', () => {
      camera.panByScreenDelta(100, 0)
      expect(camera.x).toBeLessThan(0)
    })

    it('moves camera down when dragging up (dy negative)', () => {
      camera.panByScreenDelta(0, -50)
      expect(camera.y).toBeGreaterThan(0)
    })

    it('moves camera up when dragging down (dy positive)', () => {
      camera.panByScreenDelta(0, 50)
      expect(camera.y).toBeLessThan(0)
    })

    it('scales pan amount by zoom level', () => {
      const cameraZoomed = new Camera({ zoom: 2 })
      cameraZoomed.panByScreenDelta(100, 0)
      camera.panByScreenDelta(100, 0)
      // At zoom 2, same screen delta = smaller world movement
      expect(Math.abs(cameraZoomed.x)).toBeLessThan(Math.abs(camera.x))
    })

    it('at zoom 2, pan is half the world units', () => {
      const c = new Camera({ zoom: 2 })
      c.panByScreenDelta(-200, 0)
      expect(c.x).toBeCloseTo(100)
    })
  })

  // ── Zoom limits ────────────────────────────────────────────────────

  describe('zoom limits', () => {
    it('starts at zoom 1', () => {
      expect(camera.zoom).toBe(1)
    })

    it('clamps zoom to minimum 0.1', () => {
      const center = { x: 400, y: 300 }
      for (let i = 0; i < 30; i++) {
        camera.zoomAtScreenPoint(center, center, 0.5)
      }
      expect(camera.zoom).toBeGreaterThanOrEqual(0.1)
    })

    it('clamps zoom to maximum 8', () => {
      const center = { x: 400, y: 300 }
      for (let i = 0; i < 30; i++) {
        camera.zoomAtScreenPoint(center, center, 2)
      }
      expect(camera.zoom).toBeLessThanOrEqual(8)
    })

    it('increases zoom when delta > 1', () => {
      const center = { x: 400, y: 300 }
      camera.zoomAtScreenPoint(center, center, 1.5)
      expect(camera.zoom).toBeGreaterThan(1)
    })

    it('decreases zoom when delta < 1', () => {
      const center = { x: 400, y: 300 }
      camera.zoomAtScreenPoint(center, center, 0.8)
      expect(camera.zoom).toBeLessThan(1)
    })
  })

  // ── screenToWorld ──────────────────────────────────────────────────

  describe('screenToWorld', () => {
    it('maps viewport center to world origin at default state', () => {
      const center = { x: 400, y: 300 }
      const world = camera.screenToWorld(center, center)
      expect(world.x).toBeCloseTo(0)
      expect(world.y).toBeCloseTo(0)
    })

    it('maps top-left corner correctly at zoom 1', () => {
      const center = { x: 400, y: 300 }
      const world = camera.screenToWorld({ x: 0, y: 0 }, center)
      expect(world.x).toBeCloseTo(-400)
      expect(world.y).toBeCloseTo(-300)
    })

    it('accounts for zoom level', () => {
      const c = new Camera({ zoom: 2 })
      const center = { x: 400, y: 300 }
      const world = c.screenToWorld({ x: 0, y: 0 }, center)
      expect(world.x).toBeCloseTo(-200)
      expect(world.y).toBeCloseTo(-150)
    })

    it('accounts for camera x/y offset', () => {
      const c = new Camera({ x: 100, y: 50, zoom: 1 })
      const center = { x: 400, y: 300 }
      const world = c.screenToWorld(center, center)
      expect(world.x).toBeCloseTo(100)
      expect(world.y).toBeCloseTo(50)
    })
  })

  // ── worldToScreen ──────────────────────────────────────────────────

  describe('worldToScreen', () => {
    it('maps world origin to viewport center at default state', () => {
      const center = { x: 400, y: 300 }
      const screen = camera.worldToScreen({ x: 0, y: 0 }, center)
      expect(screen.x).toBeCloseTo(400)
      expect(screen.y).toBeCloseTo(300)
    })

    it('is inverse of screenToWorld', () => {
      const center = { x: 400, y: 300 }
      const worldPoint = { x: 150, y: -75 }
      const screen = camera.worldToScreen(worldPoint, center)
      const backToWorld = camera.screenToWorld(screen, center)
      expect(backToWorld.x).toBeCloseTo(worldPoint.x)
      expect(backToWorld.y).toBeCloseTo(worldPoint.y)
    })

    it('accounts for zoom level', () => {
      const c = new Camera({ zoom: 2 })
      const center = { x: 400, y: 300 }
      const screen = c.worldToScreen({ x: 0, y: 0 }, center)
      expect(screen.x).toBeCloseTo(400)
      expect(screen.y).toBeCloseTo(300)
    })

    it('positions world point correctly at zoom 2', () => {
      const c = new Camera({ zoom: 2 })
      const center = { x: 400, y: 300 }
      const screen = c.worldToScreen({ x: 100, y: 0 }, center)
      // At zoom 2, world x=100 should be 200 screen pixels right of center
      expect(screen.x).toBeCloseTo(600)
    })
  })
})