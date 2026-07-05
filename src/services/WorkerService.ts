// src/services/WorkerService.ts
// Module 13 — main-thread worker manager

import { nanoid } from 'nanoid'
import type {
  WorkerRequest,
  WorkerResponse,
  AssetReadyPayload,
  ProgressPayload,
} from '../workers/asset-worker/workerMessages'

export interface WorkerJobResult {
  width: number
  height: number
  thumbnailDataUrl: string
}

type ProgressCallback = (percent: number, stage: string) => void

interface PendingJob {
  resolve: (result: WorkerJobResult) => void
  reject: (err: Error) => void
  onProgress?: ProgressCallback
}

export class WorkerService {
  private worker: Worker | null = null
  private jobs = new Map<string, PendingJob>()
  private available = false

  /**
   * Why: called once at app startup. Creates the Worker from a Vite
   * worker import URL. If the browser doesn't support workers or Vite
   * can't resolve the path, available stays false and the asset
   * processor falls back to main-thread processing.
   */
  init(): void {
    try {
      this.worker = new Worker(
        new URL('../workers/asset-worker/asset.worker.ts', import.meta.url),
        { type: 'module' }
      )
      this.worker.onmessage = this.handleMessage.bind(this)
      this.worker.onerror = this.handleError.bind(this)
      this.available = true
    } catch {
      console.warn('[WorkerService] Web Workers unavailable — using main thread fallback')
      this.available = false
    }
  }

  get isAvailable(): boolean { return this.available }

  /**
   * Why: converts a File to ArrayBuffer (transferable) and posts it to
   * the worker. Using transfer semantics (third arg to postMessage) means
   * the buffer is moved — not copied — to the worker, which is fast even
   * for large images.
   * Inputs: file, optional progress callback.
   * Output: promise resolving to { width, height, thumbnailDataUrl }.
   * Called by: AssetProcessor when worker is available.
   */
  async processAsset(file: File, onProgress?: ProgressCallback): Promise<WorkerJobResult> {
    if (!this.worker) throw new Error('Worker not initialized')

    const id = nanoid()
    const fileBuffer = await file.arrayBuffer()

    return new Promise<WorkerJobResult>((resolve, reject) => {
      this.jobs.set(id, { resolve, reject, onProgress })

      const request: WorkerRequest = {
        id,
        type: 'process-asset',
        payload: {
          fileBuffer,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
        },
      }

      // Transfer the ArrayBuffer — zero-copy move to worker thread
      this.worker!.postMessage(request, [fileBuffer])
    })
  }

  private handleMessage(e: MessageEvent<WorkerResponse>): void {
    const { id, type, payload, error } = e.data
    const job = this.jobs.get(id)
    if (!job) return

    if (type === 'progress') {
      const p = payload as ProgressPayload
      job.onProgress?.(p.percent, p.stage)
      return
    }

    if (type === 'error') {
      this.jobs.delete(id)
      job.reject(new Error(error ?? 'Worker error'))
      return
    }

    if (type === 'asset-ready') {
      this.jobs.delete(id)
      const result = payload as AssetReadyPayload
      job.resolve({
        width: result.width,
        height: result.height,
        thumbnailDataUrl: result.thumbnailDataUrl,
      })
    }
  }

  /**
   * Why: if the worker crashes (uncaught exception inside the worker
   * script), all pending jobs must be rejected so their callers don't
   * hang forever. We also mark the service unavailable so future calls
   * fall back to main thread.
   */
  private handleError(e: ErrorEvent): void {
    console.error('[WorkerService] Worker crashed:', e.message)
    this.available = false
    for (const [, job] of this.jobs) {
      job.reject(new Error(`Worker crashed: ${e.message}`))
    }
    this.jobs.clear()
    this.worker?.terminate()
    this.worker = null
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    this.available = false
    this.jobs.clear()
  }
}

// Singleton — one worker instance for the entire app lifetime
export const workerService = new WorkerService()