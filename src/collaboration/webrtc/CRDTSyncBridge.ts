// src/collaboration/webrtc/CRDTSyncBridge.ts
// Connects CRDTService <-> WebRTCManager with offline queue support.
//
// Fixes applied vs original:
// 1. Echo-loop prevention: applyRemoteUpdate() is called with a
//    'collab:remote' Yjs transaction origin. The onUpdate listener
//    checks the origin and skips broadcasting if it came from a
//    remote peer. Without this, receiving a CRDT update triggers an
//    onUpdate event which re-broadcasts the same update back to all
//    peers infinitely.
// 2. Stale listener accumulation: stop() now deregisters all callbacks
//    registered in start() using the off* methods added to WebRTCManager.
//    Previously, calling start() twice doubled every callback.

import * as Y from 'yjs'
import { crdtService } from '../CRDTService'
import { crdtUpdateQueue } from '../../offline/CRDTUpdateQueue'
import { networkStatus } from '../../offline/NetworkStatusService'
import type { WebRTCManager } from './WebRTCManager'
import { buildSyncResponse } from './MessageProtocol'
import type { MessageHandler, CRDTUpdateHandler, PeerJoinedHandler } from './WebRTCManager'

// Yjs transaction origin used to mark remotely-applied updates so the
// onUpdate observer can skip re-broadcasting them.
const REMOTE_ORIGIN = 'collab:remote'

export class CRDTSyncBridge {
  private webrtc: WebRTCManager
  private stopListeningToYjs: (() => void) | null = null
  private active = false

  // Keep references so we can deregister with off* on stop()
  private _onCRDTUpdate: CRDTUpdateHandler | null = null
  private _onMessage: MessageHandler | null = null
  private _onPeerJoined: PeerJoinedHandler | null = null

  constructor(webrtc: WebRTCManager) {
    this.webrtc = webrtc
  }

  /**
   * Wires up all three data flows:
   *   Local Yjs edit  → WebRTC broadcast (or offline queue)
   *   WebRTC CRDT msg → apply to local Yjs (with remote origin tag)
   *   sync:request    → send full state snapshot to requesting peer
   */
  start(): void {
    if (this.active) return
    this.active = true

    // ── Direction 1: Local Yjs → WebRTC or offline queue ──────────────
    //
    // Fix #1: The Yjs 'update' event fires for EVERY update, including
    // those applied via applyRemoteUpdate(). We tag remote applications
    // with REMOTE_ORIGIN so we can skip re-broadcasting them here.
    this.stopListeningToYjs = crdtService.onUpdate(async (update: Uint8Array, origin: unknown) => {
      // Skip updates that originated from a remote peer to prevent echo loops
      if (origin === REMOTE_ORIGIN) return

      if (!this.webrtc.isInRoom) {
        const doc = crdtService.document
        if (doc) {
          const docId = doc.meta.get('documentId') as string | undefined
          if (docId) {
            await crdtUpdateQueue.enqueue(docId, update)
            console.log('[CRDTSyncBridge] Queued offline update')
          }
        }
        return
      }

      if (!networkStatus.isOnline) {
        const doc = crdtService.document
        if (doc) {
          const docId = doc.meta.get('documentId') as string | undefined
          if (docId) await crdtUpdateQueue.enqueue(docId, update)
        }
        return
      }

      this.webrtc.broadcastCRDTUpdate(update)
    })

    // ── Direction 2: WebRTC CRDT → apply to local Yjs ─────────────────
    //
    // Fix #1 (continued): use applyRemoteUpdate with REMOTE_ORIGIN so
    // the Yjs 'update' observer above sees the origin and skips echoing.
    this._onCRDTUpdate = (update: Uint8Array) => {
      crdtService.applyRemoteUpdate(update, REMOTE_ORIGIN)
    }
    this.webrtc.onCRDTUpdate(this._onCRDTUpdate)

    // ── Direction 3: sync:request → send full state to requesting peer ─
    this._onMessage = (peerId, msg) => {
      if (msg.type !== 'sync:request') return
      if (!this.webrtc.roomId || !this.webrtc.localPeerId) return

      const fullUpdate = crdtService.export()
      if (!fullUpdate) return

      const response = buildSyncResponse(
        this.webrtc.roomId,
        this.webrtc.localPeerId,
        fullUpdate
      )
      this.webrtc.sendToPeer(peerId, response)
    }
    this.webrtc.onMessage(this._onMessage)

    // ── Direction 4: on reconnect → replay offline queue ──────────────
    this._onPeerJoined = async () => {
      await this.replayOfflineQueue()
    }
    this.webrtc.onPeerJoined(this._onPeerJoined)

    console.log('[CRDTSyncBridge] Started')
  }

  /**
   * Replay queued offline updates in sequence order after reconnect.
   * Only removes entries after successful transport submission.
   */
  async replayOfflineQueue(): Promise<void> {
    const doc = crdtService.document
    if (!doc) return
    const docId = doc.meta.get('documentId') as string | undefined
    if (!docId) return

    const queued = await crdtUpdateQueue.getAll(docId)
    if (queued.length === 0) return

    console.log(`[CRDTSyncBridge] Replaying ${queued.length} offline CRDT updates`)

    for (const entry of queued) {
      if (crdtUpdateQueue.isDuplicate(entry.id)) {
        await crdtUpdateQueue.remove(entry.id)
        continue
      }

      try {
        const update = new Uint8Array(entry.payload)
        this.webrtc.broadcastCRDTUpdate(update)
        await crdtUpdateQueue.remove(entry.id)
      } catch (err) {
        console.error('[CRDTSyncBridge] Failed to replay update:', entry.id, err)
      }
    }

    console.log('[CRDTSyncBridge] Offline queue replay complete')
  }

  /**
   * Fix #2: stop() deregisters every callback registered in start()
   * so calling start() → stop() → start() does not double-register.
   */
  stop(): void {
    if (!this.active) return
    this.stopListeningToYjs?.()
    this.stopListeningToYjs = null

    if (this._onCRDTUpdate) {
      this.webrtc.offCRDTUpdate(this._onCRDTUpdate)
      this._onCRDTUpdate = null
    }
    if (this._onMessage) {
      this.webrtc.offMessage(this._onMessage)
      this._onMessage = null
    }
    if (this._onPeerJoined) {
      this.webrtc.offPeerJoined(this._onPeerJoined)
      this._onPeerJoined = null
    }

    this.active = false
    console.log('[CRDTSyncBridge] Stopped')
  }
}