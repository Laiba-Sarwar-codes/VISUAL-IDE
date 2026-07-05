// src/offline/OfflineQueue.ts
// Module 16 — persists unsynced operations across page refreshes

import { nanoid } from 'nanoid'
import {
  OFFLINE_QUEUE_KEY,
  MAX_QUEUE_SIZE,
  MAX_RETRIES,
} from './types'
import type { OfflineOperation, OfflineOperationType } from './types'

export class OfflineQueue {
  private ops: OfflineOperation[] = []

  /**
   * Why: called at app startup to restore any operations that were
   * queued before the page was closed or refreshed while offline.
   * Without this, offline edits would be silently lost on refresh.
   */
  load(): void {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as OfflineOperation[]
      this.ops = Array.isArray(parsed) ? parsed : []
      if (this.ops.length > 0) {
        console.log(`[OfflineQueue] Restored ${this.ops.length} queued operations`)
      }
    } catch {
      console.warn('[OfflineQueue] Failed to restore queue — starting fresh')
      this.ops = []
    }
  }

  /**
   * Why: adds an operation to the queue and immediately persists to
   * localStorage so it survives refresh. Drops oldest entries if the
   * queue exceeds MAX_QUEUE_SIZE to prevent unbounded growth.
   * Inputs: type, projectId, and operation-specific payload.
   * Output: the created OfflineOperation.
   * Called by: SyncManager when an edit happens while offline.
   */
  enqueue(
    type: OfflineOperationType,
    projectId: string,
    payload: Record<string, unknown>
  ): OfflineOperation {
    const op: OfflineOperation = {
      id: nanoid(),
      type,
      timestamp: Date.now(),
      projectId,
      payload,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
    }

    this.ops.push(op)

    // Cap queue size — drop oldest if over limit
    if (this.ops.length > MAX_QUEUE_SIZE) {
      const dropped = this.ops.splice(0, this.ops.length - MAX_QUEUE_SIZE)
      console.warn(`[OfflineQueue] Queue full — dropped ${dropped.length} oldest operations`)
    }

    this.persist()
    return op
  }

  /**
   * Why: removes and returns the oldest operation for processing.
   * Called by SyncManager in FIFO order during flush so operations
   * are replayed in the same order they were originally applied.
   */
  dequeue(): OfflineOperation | null {
    const op = this.ops.shift() ?? null
    if (op) this.persist()
    return op
  }

  peek(): OfflineOperation | null {
    return this.ops[0] ?? null
  }

  /**
   * Why: if an operation fails during sync (e.g. CRDT conflict), we
   * increment its retry count and re-add it to the back of the queue.
   * After MAX_RETRIES we discard it to prevent an infinitely stuck queue.
   */
  requeueFailed(op: OfflineOperation): void {
    op.retryCount += 1
    if (op.retryCount >= op.maxRetries) {
      console.error(`[OfflineQueue] Operation ${op.id} exceeded max retries — discarding`)
      return
    }
    this.ops.push(op)
    this.persist()
  }

  clear(): void {
    this.ops = []
    this.persist()
  }

  get length(): number { return this.ops.length }
  get isEmpty(): boolean { return this.ops.length === 0 }

  getAll(): OfflineOperation[] { return [...this.ops] }

  private persist(): void {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.ops))
    } catch {
      console.warn('[OfflineQueue] Failed to persist queue to localStorage')
    }
  }
}

export const offlineQueue = new OfflineQueue()