// src/collaboration/webrtc/PresenceManager.ts
// Module 15 — manages local and remote user presence

import type { ConnectedPeer, PresencePayload } from './types'
import type { WebRTCManager } from './WebRTCManager'

export type PresenceChangeHandler = (peers: ConnectedPeer[]) => void

export class PresenceManager {
  private webrtc: WebRTCManager
  private localPresence: PresencePayload
  private onChangeCbs: Set<PresenceChangeHandler> = new Set()
  private broadcastThrottle: ReturnType<typeof setTimeout> | null = null

  constructor(webrtc: WebRTCManager, localUser: {
    userId: string
    name: string
    color: string
  }) {
    this.webrtc = webrtc
    this.localPresence = {
      userId:     localUser.userId,
      name:       localUser.name,
      color:      localUser.color,
      cursorX:    0,
      cursorY:    0,
      selectedId: null,
      lastActive: Date.now(),
    }

    // When peer presence updates arrive, notify UI
    webrtc.onMessage((peerId, msg) => {
      if (msg.type === 'presence:update') {
        this.notifyChange()
      }
    })

    webrtc.onPeerJoined(() => this.notifyChange())
    webrtc.onPeerLeft(() => this.notifyChange())
  }

  /**
   * Why: cursor moves fire very frequently (every pointermove).
   * Throttle to max one broadcast per 50ms so we don't flood peers
   * with hundreds of presence messages per second.
   */
  updateCursor(worldX: number, worldY: number): void {
    this.localPresence.cursorX = worldX
    this.localPresence.cursorY = worldY
    this.localPresence.lastActive = Date.now()
    this.scheduleBroadcast()
  }

  updateSelection(selectedId: string | null): void {
    this.localPresence.selectedId = selectedId
    this.localPresence.lastActive = Date.now()
    this.broadcastNow()
  }

  getAllPeers(): ConnectedPeer[] {
    return this.webrtc.getConnectedPeers()
  }

  onPresenceChange(cb: PresenceChangeHandler): void {
    this.onChangeCbs.add(cb)
  }

  offPresenceChange(cb: PresenceChangeHandler): void {
    this.onChangeCbs.delete(cb)
  }

  private scheduleBroadcast(): void {
    if (this.broadcastThrottle) return
    this.broadcastThrottle = setTimeout(() => {
      this.broadcastNow()
      this.broadcastThrottle = null
    }, 50)
  }

  private broadcastNow(): void {
    if (!this.webrtc.isInRoom) return
    this.webrtc.broadcastPresence(this.localPresence)
  }

  private notifyChange(): void {
    const peers = this.getAllPeers()
    this.onChangeCbs.forEach(cb => cb(peers))
  }
}