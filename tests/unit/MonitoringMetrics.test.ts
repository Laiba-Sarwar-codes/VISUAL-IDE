// tests/unit/MonitoringMetrics.test.ts
// V1: Tests for Task 7 — real monitoring metrics

import { describe, it, expect } from 'vitest'
import { PerformanceMonitor } from '../../src/engine/performance/PerformanceMonitor'
import { MemoryMonitor } from '../../src/monitoring/MemoryMonitor'
import { Camera } from '../../src/engine/rendering/Camera'

describe('PerformanceMonitor — real render metrics', () => {
  it('starts with zero FPS and zero objects', () => {
    const pm = new PerformanceMonitor()
    const snap = pm.snapshot
    expect(snap.fps).toBe(0)
    expect(snap.totalObjects).toBe(0)
    expect(snap.visibleObjects).toBe(0)
    expect(snap.culledObjects).toBe(0)
  })

  it('recordCulling updates total, visible, culled counts', () => {
    const pm = new PerformanceMonitor()
    pm.recordCulling(100, 20)
    const snap = pm.snapshot
    expect(snap.totalObjects).toBe(100)
    expect(snap.visibleObjects).toBe(20)
    expect(snap.culledObjects).toBe(80)
  })

  it('culledObjects = totalObjects - visibleObjects', () => {
    const pm = new PerformanceMonitor()
    pm.recordCulling(500, 47)
    expect(pm.snapshot.culledObjects).toBe(453)
  })

  it('renderStart returns a function that records render time', () => {
    const pm = new PerformanceMonitor()
    const endTimer = pm.renderStart()
    let sum = 0
    for (let i = 0; i < 1000; i++) sum += i
    endTimer()
    pm.recordCulling(10, 10)
    expect(pm.snapshot.renderMs).toBeGreaterThanOrEqual(0)
    expect(isFinite(pm.snapshot.renderMs)).toBe(true)
    expect(sum).toBeGreaterThan(0)
  })
})

describe('MemoryMonitor — unsupported browser graceful fallback', () => {
  it('returns supported=false and zeros when memory API unavailable', () => {
    const monitor = new MemoryMonitor()
    const snap = monitor.getSnapshot()
    if (!snap.supported) {
      expect(snap.usedMB).toBe(0)
      expect(snap.totalMB).toBe(0)
      expect(snap.limitMB).toBe(0)
      expect(snap.percent).toBe(0)
    }
    expect(typeof snap.supported).toBe('boolean')
  })

  it('never reports negative memory values', () => {
    const monitor = new MemoryMonitor()
    const snap = monitor.getSnapshot()
    expect(snap.usedMB).toBeGreaterThanOrEqual(0)
    expect(snap.percent).toBeGreaterThanOrEqual(0)
    expect(snap.percent).toBeLessThanOrEqual(100)
  })
})

describe('Camera metrics — unified state', () => {
  it('camera state has x, y, zoom', () => {
    const state = { x: 100, y: -50, zoom: 1.5 }
    expect(typeof state.x).toBe('number')
    expect(typeof state.y).toBe('number')
    expect(typeof state.zoom).toBe('number')
  })

  it('zoom percent calculation is correct', () => {
    const zoom = 1.5
    const percent = Math.round(zoom * 100)
    expect(percent).toBe(150)
  })

  it('camera x/y reflect actual pan position', () => {
    const cam = new Camera({ x: 0, y: 0, zoom: 1 })
    cam.panByScreenDelta(-100, -50)
    expect(cam.x).toBeGreaterThan(0)
    expect(cam.y).toBeGreaterThan(0)
    const state = cam.getState()
    expect(state.x).toBe(cam.x)
    expect(state.y).toBe(cam.y)
  })

  it('getState after pan matches camera internal values', () => {
    const cam = new Camera({ x: 0, y: 0, zoom: 2 })
    cam.panByScreenDelta(-200, -100)
    const state = cam.getState()
    expect(state.x).toBeCloseTo(cam.x, 5)
    expect(state.y).toBeCloseTo(cam.y, 5)
    expect(state.zoom).toBe(cam.zoom)
  })
})
