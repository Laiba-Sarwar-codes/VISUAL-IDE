// src/engine/performance/PerformanceMonitor.ts
// Module 11 — FPS, render time, culling stats

export interface PerfSnapshot {
  fps: number
  renderMs: number
  totalObjects: number
  visibleObjects: number
  culledObjects: number
}

export class PerformanceMonitor {
  private frameTimes: number[] = []
  private lastFrameTime = 0
  private _renderMs = 0
  private _snapshot: PerfSnapshot = {
    fps: 0, renderMs: 0,
    totalObjects: 0, visibleObjects: 0, culledObjects: 0,
  }

  /**
   * Why: called at the start of every draw call. Records the timestamp
   * so renderEnd() can compute how long the draw took.
   * Output: a function to call at the end of the draw (renderEnd).
   */
  renderStart(): () => void {
    const start = performance.now()
    return () => { this._renderMs = performance.now() - start }
  }

  /**
   * Why: tracks how many frames per second the render loop is achieving.
   * Uses a rolling 60-frame window to smooth the FPS display.
   * Called by: RenderLoop on every tick (not just dirty ticks).
   */
  tick(): void {
    const now = performance.now()
    if (this.lastFrameTime) {
      this.frameTimes.push(now - this.lastFrameTime)
      if (this.frameTimes.length > 60) this.frameTimes.shift()
    }
    this.lastFrameTime = now
  }

  recordCulling(total: number, visible: number): void {
    this._snapshot = {
      fps: this.computeFPS(),
      renderMs: Math.round(this._renderMs * 100) / 100,
      totalObjects: total,
      visibleObjects: visible,
      culledObjects: total - visible,
    }
  }

  get snapshot(): PerfSnapshot { return this._snapshot }

  private computeFPS(): number {
    if (this.frameTimes.length < 2) return 0
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    return Math.round(1000 / avg)
  }
}