import { nanoid } from 'nanoid'
import type { SceneObject } from '../../engine/scene-graph/types'
import type { AIEditorContext, AIExecutionPlan } from '../../ai/planTypes'
import type { WorkerRequest, WorkerResponse } from './types'

class WorkerRPC {
  private worker: Worker | null = null
  private readonly pending = new Map<string, {
    resolve: (value: unknown) => void
    reject: (reason?: unknown) => void
  }>()

  constructor(private readonly factory: () => Worker) {}

  request<T>(type: string, payload: unknown): Promise<T> {
    if (!this.worker) this.start()
    const worker = this.worker
    if (!worker) return Promise.reject(new Error('Web Workers are unavailable.'))
    const id = nanoid()
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      })
      const message: WorkerRequest = { id, type, payload }
      worker.postMessage(message)
    })
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null
    for (const pending of this.pending.values()) {
      pending.reject(new Error('Worker terminated.'))
    }
    this.pending.clear()
  }

  private start(): void {
    if (typeof Worker === 'undefined') return
    const worker = this.factory()
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const pending = this.pending.get(event.data.id)
      if (!pending) return
      this.pending.delete(event.data.id)
      if (event.data.success) pending.resolve(event.data.result)
      else pending.reject(new Error(event.data.error))
    }
    worker.onerror = (event) => {
      const error = new Error(event.message || 'Worker failed.')
      for (const pending of this.pending.values()) pending.reject(error)
      this.pending.clear()
    }
    this.worker = worker
  }
}

export class Priority2WorkerPool {
  private readonly compression = new WorkerRPC(() => new Worker(new URL('./compression.worker.ts', import.meta.url), { type: 'module' }))
  private readonly crdt = new WorkerRPC(() => new Worker(new URL('./crdt.worker.ts', import.meta.url), { type: 'module' }))
  private readonly history = new WorkerRPC(() => new Worker(new URL('./history.worker.ts', import.meta.url), { type: 'module' }))
  private readonly ai = new WorkerRPC(() => new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' }))
  private readonly exporter = new WorkerRPC(() => new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' }))
  private readonly renderer = new WorkerRPC(() => new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module' }))

  get available(): boolean { return typeof Worker !== 'undefined' }

  compress(bytes: Uint8Array) {
    return this.compression.request<{ bytes: number[]; compressed: boolean }>('compress', { bytes: Array.from(bytes), format: 'gzip' })
  }

  decompress(bytes: Uint8Array) {
    return this.compression.request<{ bytes: number[]; decompressed: boolean }>('decompress', { bytes: Array.from(bytes), format: 'gzip' })
  }

  mergeCRDTUpdates(updates: Uint8Array[]) {
    return this.crdt.request<{ update: number[] }>('merge-updates', { updates: updates.map(Array.from) })
  }

  compareHistory(before: unknown[], after: unknown[]) {
    return this.history.request<{ changed: boolean; beforeBytes: number; afterBytes: number }>('compare-snapshots', { before, after })
  }

  parseAIInstruction(instruction: string) {
    return this.ai.request<{ normalized: string; operations: Array<Record<string, string | number>>; confidence: number }>('parse-instruction', { instruction })
  }

  /** Real AI Workflow pipeline entry point — runs prompt parsing + reference resolution + plan building inside the worker thread. See AIWorkerClient.ts for the timeout/cancellation/fallback wrapper. */
  buildAIPlan(prompt: string, context: AIEditorContext) {
    return this.ai.request<AIExecutionPlan>('build-plan', { prompt, context })
  }

  serializeScene(title: string, objects: unknown[]) {
    return this.exporter.request<{ json: string; bytes: number }>('serialize-scene', { title, objects })
  }

  renderPreview(objects: SceneObject[], width: number, height: number, background = '#ffffff') {
    return this.renderer.request<{ supported: boolean; blob: Blob | null }>('render-preview', {
      objects,
      width,
      height,
      background,
    })
  }

  terminate(): void {
    this.compression.terminate()
    this.crdt.terminate()
    this.history.terminate()
    this.ai.terminate()
    this.exporter.terminate()
    this.renderer.terminate()
  }
}
