// src/monitoring/types.ts
// Module 21 — Monitoring Dashboard type definitions

export interface FPSSnapshot {
  fps: number
  frameTime: number     // ms per frame, rolling average
  dropped: number       // frames below 30fps in last second
}

export interface MemorySnapshot {
  supported: boolean    // false when performance.memory unavailable
  usedMB: number        // JS heap used
  totalMB: number       // JS heap total
  limitMB: number       // JS heap size limit
  percent: number       // usedMB / limitMB * 100
}

export interface SceneSnapshot {
  totalObjects: number
  visibleObjects: number
  hiddenObjects: number
  lockedObjects: number
  selectedObjects: number
}

export interface RenderSnapshot {
  renderedObjects: number
  culledObjects: number
  frameTimeMs: number
  fps: number
}

export interface NetworkSnapshot {
  status: 'online' | 'offline' | 'reconnecting'
  queuedOps: number
}

export interface CollabSnapshot {
  inRoom: boolean
  roomId: string | null
  peersCount: number
}

export interface WorkerSnapshot {
  assetWorker: 'available' | 'unavailable'
}

export interface CameraSnapshot {
  x: number
  y: number
  zoom: number
}

export interface EditorSnapshot {
  activeTool: string
  activeProjectName: string
  currentBranch: string
  commitCount: number
}

/**
 * AI Workflow (2026-07-05) — populated from the aiWorkflow Pinia store's
 * own `metrics` state each poll, matching this file's existing pattern of
 * reading a plain snapshot from another store rather than a push-based
 * event log (there is no event-log API elsewhere in this monitoring
 * system to plug into).
 */
export interface AISnapshot {
  lastParseDurationMs: number
  lastWorkerDurationMs: number
  lastValidationDurationMs: number
  lastExecutionDurationMs: number
  lastOperationCount: number
  lastAffectedObjectCount: number
  lastProviderId: string | null
  lastSuccess: boolean | null
  totalRequests: number
  totalCancelled: number
  totalFailures: number
}

/**
 * Why: one MonitoringSnapshot holds ALL metrics at a point in time.
 * The store reads this snapshot on a timer and updates its reactive
 * state in one batch — prevents partial updates causing UI flicker.
 */
export interface MonitoringSnapshot {
  fps: FPSSnapshot
  memory: MemorySnapshot
  scene: SceneSnapshot
  render: RenderSnapshot
  network: NetworkSnapshot
  collab: CollabSnapshot
  workers: WorkerSnapshot
  camera: CameraSnapshot
  editor: EditorSnapshot
  ai: AISnapshot
  capturedAt: number
}