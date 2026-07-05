// src/monitoring/FPSMonitor.ts
// Module 21 — real-time FPS tracking via rAF

import type { FPSSnapshot } from './types'

const WINDOW_SIZE = 60     // frames to average
const DROP_THRESHOLD = 30  // fps below this = dropped frame

export class FPSMonitor {
  private frameTimes: number[] = []
  private lastTime = 0
  private rafId: number | null = null
  private dropped = 0
  private running = false

  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now()
    this.tick()
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.frameTimes = []
    this.dropped = 0
  }

  /**
   * Why: records the time delta between each rAF call. Using a rolling
   * window of the last 60 frames gives a stable FPS value that doesn't
   * jump wildly on individual long frames.
   */
  private tick = (): void => {
    if (!this.running) return

    const now = performance.now()
    const delta = now - this.lastTime
    this.lastTime = now

    this.frameTimes.push(delta)
    if (this.frameTimes.length > WINDOW_SIZE) this.frameTimes.shift()

    const instantFps = 1000 / delta
    if (instantFps < DROP_THRESHOLD) this.dropped++

    this.rafId = requestAnimationFrame(this.tick)
  }

  getSnapshot(): FPSSnapshot {
    if (this.frameTimes.length === 0) {
      return { fps: 0, frameTime: 0, dropped: 0 }
    }
    const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    const fps = Math.round(1000 / avgDelta)
    const dropped = this.dropped
    this.dropped = 0   // reset dropped counter each read
    return {
      fps: Math.min(fps, 144),
      frameTime: Math.round(avgDelta * 100) / 100,
      dropped,
    }
  }
}