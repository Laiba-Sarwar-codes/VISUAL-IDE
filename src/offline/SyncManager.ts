// src/offline/SyncManager.ts
// Module 16 — flushes offline queue when network reconnects

import { offlineQueue } from './OfflineQueue'
import { networkStatus } from './NetworkStatusService'
import type { OfflineOperation } from './types'

type FlushCallback = (op: OfflineOperation) => Promise<boolean>
type SyncStatusCallback = (queueLength: number) => void

export class SyncManager {
  private flushHandler: FlushCallback | null = null
  private onStatusChange: SyncStatusCallback | null = null
  private flushing = false
  private stopNetworkWatch: (() => void) | null = null

  /**
   * Why: registers the function that actually processes each queued
   * operation. The SyncManager doesn't know what to do with a
   * 'scene:add' operation — the caller (useOffline composable) provides
   * a handler that applies each op to the scene store or CRDT layer.
   * This keeps SyncManager generic and reusable.
   */
  setFlushHandler(handler: FlushCallback): void {
    this.flushHandler = handler
  }

  onQueueChange(cb: SyncStatusCallback): void {
    this.onStatusChange = cb
  }

  /**
   * Why: starts watching the network status service. When status
   * transitions to 'online', we trigger a flush automatically so
   * the user doesn't need to do anything to resync after reconnecting.
   */
  start(): void {
    this.stopNetworkWatch = networkStatus.onChange((status) => {
      if (status === 'online' && !offlineQueue.isEmpty) {
        console.log(`[SyncManager] Back online — flushing ${offlineQueue.length} queued ops`)
        this.flush()
      }
    })
    console.log('[SyncManager] Started')
  }

  stop(): void {
    this.stopNetworkWatch?.()
    this.stopNetworkWatch = null
  }

  /**
   * Why: processes all queued operations in order. If the network
   * drops mid-flush, stops immediately and leaves remaining ops in
   * the queue for the next reconnect. Failed operations are re-queued
   * with an incremented retry count rather than silently dropped.
   * Called by: network 'online' event, and manually by useOffline.
   */
  async flush(): Promise<void> {
    if (this.flushing || !this.flushHandler) return
    if (offlineQueue.isEmpty) return
    if (!networkStatus.isOnline) return

    this.flushing = true
    console.log(`[SyncManager] Flushing ${offlineQueue.length} operations…`)

    while (!offlineQueue.isEmpty) {
      if (!networkStatus.isOnline) {
        console.log('[SyncManager] Went offline during flush — pausing')
        break
      }

      const op = offlineQueue.dequeue()
      if (!op) break

      try {
        const success = await this.flushHandler(op)
        if (!success) {
          offlineQueue.requeueFailed(op)
        }
      } catch (err) {
        console.error('[SyncManager] Operation failed:', op.type, err)
        offlineQueue.requeueFailed(op)
      }

      this.onStatusChange?.(offlineQueue.length)
    }

    this.flushing = false
    console.log(`[SyncManager] Flush complete — ${offlineQueue.length} remaining`)
  }

  get isFlushing(): boolean { return this.flushing }
}

export const syncManager = new SyncManager()