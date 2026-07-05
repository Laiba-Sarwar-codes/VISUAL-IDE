// src/engine/rendering/RenderLoop.ts
// Module 11 — ticks perf monitor every frame

import { PerformanceMonitor } from '../performance/PerformanceMonitor'

export class RenderLoop {
  private dirty = false
  private rafId: number | null = null
  private callback: () => void
  private perf: PerformanceMonitor

  constructor(callback: () => void, perf?: PerformanceMonitor) {
    this.callback = callback
    this.perf = perf ?? new PerformanceMonitor()
  }

  markDirty(): void { this.dirty = true }

  start(): void {
    const tick = () => {
      this.perf.tick()
      if (this.dirty) {
        this.callback()
        this.dirty = false
      }
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }
}