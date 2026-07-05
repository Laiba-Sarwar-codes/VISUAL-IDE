// app/composables/useOffline.ts
// Module 16 — initializes offline detection and sync

import { onUnmounted } from 'vue'
import { networkStatus } from '~~/src/offline/NetworkStatusService'
import { offlineQueue } from '~~/src/offline/OfflineQueue'
import { syncManager } from '~~/src/offline/SyncManager'
import { crdtService } from '~~/src/collaboration/CRDTService'
import { useOfflineStore } from '~/stores/offline'
import { useSceneStore } from '~/stores/scene'
import { useProjectStore } from '~/stores/project'
import type { OfflineOperation } from '~~/src/offline/types'

export function useOffline() {
  const offline = useOfflineStore()
  const scene = useSceneStore()
  const project = useProjectStore()

  offline.init()

  /**
   * Why: this handler is the bridge between the generic SyncManager
   * and the actual editor systems. Each operation type maps to the
   * correct scene store or CRDT action. Returning false signals
   * SyncManager to retry; throwing causes it to requeue with retry++.
   */
  syncManager.setFlushHandler(async (op: OfflineOperation): Promise<boolean> => {
    try {
      switch (op.type) {
        case 'crdt:update': {
          const raw = op.payload.update as number[]
          if (!Array.isArray(raw)) return false
          const update = new Uint8Array(raw)
          crdtService.applyRemoteUpdate(update)
          return true
        }

        case 'scene:add':
        case 'scene:update':
        case 'scene:remove':
        case 'scene:reorder':
          // Scene changes are already reflected in the local scene store
          // and will be persisted via autosave — no extra action needed.
          // When collaboration is active, CRDT handles the sync.
          return true

        default:
          console.warn('[useOffline] Unknown operation type:', op.type)
          return true // discard unknown ops
      }
    } catch (err) {
      console.error('[useOffline] Flush handler error:', err)
      return false
    }
  })

  syncManager.onQueueChange((length) => {
    offline.syncQueueLength()
    if (length === 0) offline.setLastSynced()
  })

  syncManager.start()

  /**
   * Why: queues a CRDT update for later sync when offline.
   * Called by the collaboration layer when a local Yjs update
   * happens but WebRTC peers are unreachable.
   * Inputs: the binary Yjs update from crdtService.onUpdate().
   */
  function queueCRDTUpdate(update: Uint8Array): void {
    if (networkStatus.isOnline) return // no need to queue if online
    offlineQueue.enqueue('crdt:update', project.activeProjectId ?? 'local', {
      update: Array.from(update),
    })
    offline.syncQueueLength()
  }

  function manualFlush(): Promise<void> {
    return syncManager.flush()
  }

  onUnmounted(() => {
    syncManager.stop()
    networkStatus.stop()
  })

  return { queueCRDTUpdate, manualFlush }
}