// src/monitoring/MemoryMonitor.ts
// Module 21 — JS heap memory tracking with graceful fallback

import type { MemorySnapshot } from './types'

/**
 * Why: performance.memory is a non-standard Chrome extension.
 * TypeScript doesn't include it in the Performance type, so we declare
 * the shape locally and check at runtime before accessing.
 */
interface PerformanceWithMemory extends Performance {
  readonly memory: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

function hasMemoryAPI(): boolean {
  return (
    typeof performance !== 'undefined' &&
    'memory' in performance
  )
}

export class MemoryMonitor {
  private readonly supported: boolean

  constructor() {
    this.supported = hasMemoryAPI()
    if (!this.supported) {
      console.info('[MemoryMonitor] performance.memory not available — using fallback values')
    }
  }

  /**
   * Why: reading memory is synchronous and cheap — no rAF loop needed.
   * Called by MonitoringService on its polling interval instead.
   * Output: MemorySnapshot with supported=false and zeros when unavailable.
   */
  getSnapshot(): MemorySnapshot {
    if (!this.supported) {
      return {
        supported: false,
        usedMB: 0,
        totalMB: 0,
        limitMB: 0,
        percent: 0,
      }
    }

    const mem = (performance as PerformanceWithMemory).memory
    const toMB = (bytes: number) => Math.round(bytes / 1024 / 1024 * 10) / 10

    const usedMB  = toMB(mem.usedJSHeapSize)
    const totalMB = toMB(mem.totalJSHeapSize)
    const limitMB = toMB(mem.jsHeapSizeLimit)
    const percent = limitMB > 0 ? Math.round((usedMB / limitMB) * 100) : 0

    return { supported: true, usedMB, totalMB, limitMB, percent }
  }
}