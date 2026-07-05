// src/monitoring/MonitoringService.ts
// Module 21 — assembles MonitoringSnapshot from all monitors

import { FPSMonitor } from './FPSMonitor'
import { MemoryMonitor } from './MemoryMonitor'
import type { MonitoringSnapshot } from './types'

/**
 * Why: MonitoringService owns the FPS and memory monitors (which have
 * their own internal loops) but does NOT import Pinia stores. Instead
 * it exposes getSnapshot() and the caller (monitoring store) injects
 * the current store values. This prevents circular imports and keeps
 * the service independently testable.
 */
export class MonitoringService {
  readonly fps = new FPSMonitor()
  readonly memory = new MemoryMonitor()
  private running = false

  start(): void {
    if (this.running) return
    this.running = true
    this.fps.start()
    console.log('[MonitoringService] Started')
  }

  stop(): void {
    this.running = false
    this.fps.stop()
    console.log('[MonitoringService] Stopped')
  }

  get isRunning(): boolean { return this.running }

  /**
   * Why: called by the monitoring Pinia store on every poll tick.
   * The store passes in the current values it already has from other
   * stores — MonitoringService just handles the monitors it owns
   * (FPS, memory) and merges everything into one snapshot.
   * Inputs: partial values from Pinia stores (injected by caller).
   * Output: complete MonitoringSnapshot for the dashboard.
   */
  buildSnapshot(injected: Omit<MonitoringSnapshot, 'fps' | 'memory' | 'capturedAt'>): MonitoringSnapshot {
    return {
      fps:         this.fps.getSnapshot(),
      memory:      this.memory.getSnapshot(),
      capturedAt:  Date.now(),
      ...injected,
    }
  }
}

export const monitoringService = new MonitoringService()