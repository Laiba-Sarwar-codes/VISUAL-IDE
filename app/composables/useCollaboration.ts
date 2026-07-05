// app/composables/useCollaboration.ts
// Module 15 — wires CRDT + WebRTC + Presence together
//
// Fixes applied:
// 1. crdtBridge and presenceManager are no longer module-level singletons.
//    They are owned by the composable instance and properly torn down when
//    leaveRoom() is called so that re-joining a room starts clean.
// 2. joinRoom() guards against double-join: if already in a room, leave
//    first before joining the new one.
// 3. crdtService.create() is called if no document exists yet (user joins
//    a room without ever creating a project — common in quick-share flows).

import { watch, onUnmounted } from 'vue'
import { crdtService } from '~~/src/collaboration/CRDTService'
import { startSceneSync } from '~~/src/collaboration/SceneSync'
import { webRTCManager } from '~~/src/collaboration/webrtc/WebRTCManager'
import { CRDTSyncBridge } from '~~/src/collaboration/webrtc/CRDTSyncBridge'
import { PresenceManager } from '~~/src/collaboration/webrtc/PresenceManager'
import { awareness } from '~~/src/collaboration/Awareness'
import { useProjectStore } from '~/stores/project'
import { useSceneStore } from '~/stores/scene'

export function useCollaboration() {
  const project = useProjectStore()
  const scene = useSceneStore()
  let stopSceneSync: (() => void) | null = null

  // Fix #1: instance-level (not module-level) so leaveRoom() can tear them down
  let crdtBridge: CRDTSyncBridge | null = null
  let presenceManager: PresenceManager | null = null

  watch(
    () => project.activeProjectId,
    (id) => {
      stopSceneSync?.()
      stopSceneSync = null
      crdtService.destroy()

      if (!id) return

      crdtService.create(project.activeProjectName)

      const doc = crdtService.document
      if (!doc) return

      stopSceneSync = startSceneSync(doc, scene)
      console.log('[Collaboration] Scene sync started for project:', id)
    },
    { immediate: true }
  )

  onUnmounted(() => {
    stopSceneSync?.()
    crdtService.destroy()
  })

  return {
    crdtService,
    webRTCManager,
    awareness,

    /**
     * Join a collaboration room. Guards against double-join and ensures
     * a CRDT document exists before wiring up the WebRTC bridge.
     */
    async joinRoom(roomId: string): Promise<void> {
      // Fix #2: leave any existing room first to start clean
      if (webRTCManager.isInRoom) {
        crdtBridge?.stop()
        crdtBridge = null
        presenceManager = null
        webRTCManager.leaveRoom()
      }

      // Fix #3: ensure CRDT document exists even if no project is open
      if (!crdtService.isInitialized) {
        crdtService.create(project.activeProjectName || 'Shared Project')
        const doc = crdtService.document
        if (doc) {
          stopSceneSync?.()
          stopSceneSync = startSceneSync(doc, scene)
        }
      }

      const user = awareness.localUser

      await webRTCManager.joinRoom(roomId, {
        userId: user.id,
        name:   user.name,
        color:  user.color,
      })

      // Fix #1: always create fresh bridge/manager after joining
      crdtBridge = new CRDTSyncBridge(webRTCManager)
      crdtBridge.start()

      presenceManager = new PresenceManager(webRTCManager, {
        userId: user.id,
        name:   user.name,
        color:  user.color,
      })

      console.log('[Collaboration] Joined room:', roomId)
    },

    leaveRoom(): void {
      crdtBridge?.stop()
      crdtBridge = null
      presenceManager = null
      webRTCManager.leaveRoom()
      console.log('[Collaboration] Left room')
    },

    updateCursor(worldX: number, worldY: number): void {
      presenceManager?.updateCursor(worldX, worldY)
    },

    updateSelection(selectedId: string | null): void {
      presenceManager?.updateSelection(selectedId)
      awareness.updateSelection(selectedId)
    },

    getPresenceManager(): PresenceManager | null {
      return presenceManager
    },
  }
}