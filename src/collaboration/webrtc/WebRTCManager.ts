// src/collaboration/webrtc/WebRTCManager.ts
// Module 15 — main WebRTC orchestrator
//
// Fixes applied vs original:
// 1. Default signaling uses WebSocketSignaling instead of
//    BroadcastChannelSignaling so incognito <-> normal windows work.
// 2. onMessage handler is registered BEFORE connect() sends room:join,
//    so we never miss an offer from a peer who responds immediately.
// 3. Added offPeerJoined / offPeerLeft so callers can clean up.
// 4. CRDTSyncBridge-facing onCRDTUpdate / offCRDTUpdate / onMessage /
//    offMessage now properly deregister to avoid duplicate callbacks
//    on re-start.

import {
  WebSocketSignaling,
  type ISignalingClient,
} from './SignalingClient'
import { PeerConnectionManager } from './PeerConnectionManager'
import { DataChannelManager } from './DataChannelManager'
import {
  buildMessage,
  buildCRDTUpdate,
  buildPresenceUpdate,
  buildSyncResponse,
  buildPing,
} from './MessageProtocol'
import type {
  PeerMessage,
  ConnectedPeer,
  PresencePayload,
  RoomInfo,
  SignalingMessage,
  CRDTUpdatePayload,
  SyncResponsePayload,
} from './types'

const PEER_TIMEOUT_MS = 15_000
const PING_INTERVAL_MS = 5_000

export type PeerJoinedHandler = (peer: ConnectedPeer) => void
export type PeerLeftHandler = (peerId: string) => void
export type MessageHandler = (peerId: string, msg: PeerMessage) => void
export type CRDTUpdateHandler = (update: Uint8Array) => void

export class WebRTCManager {
  private signaling: ISignalingClient
  private peerManager = new PeerConnectionManager()
  private channelManager = new DataChannelManager()
  private peers = new Map<string, ConnectedPeer>()
  private room: RoomInfo | null = null
  private seenUpdateIds = new Set<string>()

  private onPeerJoinedCbs: Set<PeerJoinedHandler> = new Set()
  private onPeerLeftCbs: Set<PeerLeftHandler> = new Set()
  private onMessageCbs: Set<MessageHandler> = new Set()
  private onCRDTUpdateCbs: Set<CRDTUpdateHandler> = new Set()

  private pingInterval: ReturnType<typeof setInterval> | null = null

  constructor(signaling?: ISignalingClient) {
    // Fix #1: default to WebSocketSignaling so cross-context (normal <->
    // incognito) rooms work. BroadcastChannel only works within a single
    // browser context/process.
    this.signaling = signaling ?? new WebSocketSignaling()
    this.wirePeerManager()
    this.wireChannelManager()
  }

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Fix #2: register the signaling handler BEFORE calling
   * signaling.connect(), which sends room:join. If a peer in the room
   * responds with an offer the instant it receives that join broadcast,
   * we must already be listening or the offer is silently dropped.
   */
  async joinRoom(roomId: string, userInfo: {
    userId: string
    name: string
    color: string
  }): Promise<void> {
    this.room = { roomId, peerId: userInfo.userId, ...userInfo }

    // Register handler FIRST so we don't miss the immediate offer response
    this.signaling.onMessage(this.handleSignalingMessage)

    await this.signaling.connect(roomId, userInfo.userId)
    this.startPingInterval()
    console.log(`[WebRTC] Joined room: ${roomId} as ${userInfo.userId}`)
  }

  leaveRoom(): void {
    this.stopPingInterval()
    this.signaling.offMessage(this.handleSignalingMessage)
    this.signaling.disconnect()
    this.channelManager.closeAll()
    this.peerManager.closeAll()
    this.peers.clear()
    this.room = null
    console.log('[WebRTC] Left room')
  }

  /**
   * Broadcasts the binary CRDT update to all connected peers.
   * Uses deduplication ids to avoid echo loops.
   */
  broadcastCRDTUpdate(update: Uint8Array): void {
    if (!this.room) return
    const msg = buildCRDTUpdate(this.room.roomId, this.room.peerId, update)
    const payload = msg.payload as unknown as CRDTUpdatePayload
    this.seenUpdateIds.add(payload.updateId)
    this.channelManager.broadcast(msg)
  }

  /**
   * Presence (cursor, selection) broadcast — sent frequently, no CRDT
   * semantics needed, just forward current state to all peers.
   */
  broadcastPresence(presence: PresencePayload): void {
    if (!this.room) return
    const msg = buildPresenceUpdate(this.room.roomId, this.room.peerId, presence)
    this.channelManager.broadcast(msg)
  }

  sendToPeer(peerId: string, msg: PeerMessage): void {
    this.channelManager.sendToPeer(peerId, msg)
  }

  getConnectedPeers(): ConnectedPeer[] {
    return Array.from(this.peers.values())
  }

  get isInRoom(): boolean { return this.room !== null }
  get roomId(): string | null { return this.room?.roomId ?? null }
  get localPeerId(): string | null { return this.room?.peerId ?? null }

  // Fix #3: expose off* counterparts so CRDTSyncBridge and PresenceManager
  // can deregister their callbacks on stop()/destroy() to prevent
  // duplicate firings if start() is called more than once.
  onPeerJoined(cb: PeerJoinedHandler): void { this.onPeerJoinedCbs.add(cb) }
  offPeerJoined(cb: PeerJoinedHandler): void { this.onPeerJoinedCbs.delete(cb) }
  onPeerLeft(cb: PeerLeftHandler): void { this.onPeerLeftCbs.add(cb) }
  offPeerLeft(cb: PeerLeftHandler): void { this.onPeerLeftCbs.delete(cb) }
  onMessage(cb: MessageHandler): void { this.onMessageCbs.add(cb) }
  offMessage(cb: MessageHandler): void { this.onMessageCbs.delete(cb) }
  onCRDTUpdate(cb: CRDTUpdateHandler): void { this.onCRDTUpdateCbs.add(cb) }
  offCRDTUpdate(cb: CRDTUpdateHandler): void { this.onCRDTUpdateCbs.delete(cb) }

  // ── Signaling handlers ────────────────────────────────────────────────

  private handleSignalingMessage = async (msg: SignalingMessage): Promise<void> => {
    switch (msg.type) {
      case 'room:join':    await this.handlePeerJoinedSignaling(msg); break
      case 'room:leave':   this.handlePeerLeftSignaling(msg); break
      case 'offer':        await this.handleOffer(msg); break
      case 'answer':       await this.handleAnswer(msg); break
      case 'ice:candidate': await this.handleICECandidate(msg); break
    }
  }

  /**
   * When a new peer joins the room via signaling, we (as existing peer)
   * initiate the WebRTC offer so they can connect to us.
   */
  private async handlePeerJoinedSignaling(msg: SignalingMessage): Promise<void> {
    if (!this.room) return
    const remotePeerId = msg.fromPeerId
    if (remotePeerId === this.room.peerId) return  // ignore our own echo
    const pc = this.peerManager.create(remotePeerId)
    this.channelManager.createChannel(remotePeerId, pc)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    this.signaling.send({
      type: 'offer',
      roomId: this.room.roomId,
      fromPeerId: this.room.peerId,
      toPeerId: remotePeerId,
      payload: offer,
    })
  }

  private handlePeerLeftSignaling(msg: SignalingMessage): void {
    this.removePeer(msg.fromPeerId)
  }

  private async handleOffer(msg: SignalingMessage): Promise<void> {
    if (!this.room) return
    const remotePeerId = msg.fromPeerId
    const pc = this.peerManager.create(remotePeerId)

    await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    this.signaling.send({
      type: 'answer',
      roomId: this.room.roomId,
      fromPeerId: this.room.peerId,
      toPeerId: remotePeerId,
      payload: answer,
    })
  }

  private async handleAnswer(msg: SignalingMessage): Promise<void> {
    const pc = this.peerManager.get(msg.fromPeerId)
    if (!pc) return
    await pc.setRemoteDescription(msg.payload as RTCSessionDescriptionInit)
  }

  private async handleICECandidate(msg: SignalingMessage): Promise<void> {
    const pc = this.peerManager.get(msg.fromPeerId)
    if (!pc) return
    try {
      await pc.addIceCandidate(msg.payload as RTCIceCandidateInit)
    } catch (err) {
      console.warn('[WebRTC] ICE candidate error:', err)
    }
  }

  // ── Peer/channel event wiring ─────────────────────────────────────────

  private wirePeerManager(): void {
    this.peerManager.setHandlers({
      onICECandidate: (peerId, candidate) => {
        if (!this.room) return
        this.signaling.send({
          type: 'ice:candidate',
          roomId: this.room.roomId,
          fromPeerId: this.room.peerId,
          toPeerId: peerId,
          payload: candidate,
        })
      },
      onConnectionStateChange: (peerId, state) => {
        const peer = this.peers.get(peerId)
        if (peer) peer.connectionState = state
        if (state === 'failed' || state === 'disconnected') {
          this.removePeer(peerId)
        }
      },
      onDataChannel: (peerId, channel) => {
        this.channelManager.registerChannel(peerId, channel)
      },
    })
  }

  private wireChannelManager(): void {
    this.channelManager.onStateChange((peerId, state) => {
      if (state === 'open') this.onChannelOpen(peerId)
      if (state === 'closed') this.removePeer(peerId)
    })

    this.channelManager.onMessage((peerId, msg) => {
      this.handlePeerMessage(peerId, msg)
    })
  }

  private onChannelOpen(peerId: string): void {
    if (!this.room) return
    const peer: ConnectedPeer = {
      peerId,
      userId: peerId,
      name: `User ${peerId.slice(0, 4)}`,
      color: '#3b82f6',
      cursorX: 0,
      cursorY: 0,
      selectedId: null,
      connectionState: 'connected',
      lastActive: Date.now(),
    }
    this.peers.set(peerId, peer)
    this.onPeerJoinedCbs.forEach(cb => cb(peer))

    // Ask new peer for their full CRDT state so we sync immediately
    const syncMsg = buildMessage(
      'sync:request',
      this.room.roomId,
      this.room.peerId,
      {}
    )
    this.channelManager.sendToPeer(peerId, syncMsg)
  }

  /**
   * Routes incoming data channel messages to correct handlers.
   * CRDT updates are deduplicated before being applied.
   */
  private handlePeerMessage(peerId: string, msg: PeerMessage): void {
    const peer = this.peers.get(peerId)
    if (peer) peer.lastActive = Date.now()

    this.onMessageCbs.forEach(cb => cb(peerId, msg))

    switch (msg.type) {
      case 'crdt:update': {
        const payload = msg.payload as unknown as CRDTUpdatePayload
        if (this.seenUpdateIds.has(payload.updateId)) return
        this.seenUpdateIds.add(payload.updateId)
        const update = new Uint8Array(payload.update)
        this.onCRDTUpdateCbs.forEach(cb => cb(update))
        break
      }
      case 'presence:update': {
        const p = msg.payload as unknown as PresencePayload
        const pr = this.peers.get(peerId)
        if (pr) {
          pr.name = p.name
          pr.color = p.color
          pr.cursorX = p.cursorX
          pr.cursorY = p.cursorY
          pr.selectedId = p.selectedId
          pr.lastActive = Date.now()
        }
        break
      }
      case 'sync:response': {
        const payload = msg.payload as unknown as SyncResponsePayload
        const update = new Uint8Array(payload.update)
        this.onCRDTUpdateCbs.forEach(cb => cb(update))
        break
      }
      case 'ping': {
        if (!this.room) return
        this.channelManager.sendToPeer(
          peerId,
          buildMessage('pong', this.room.roomId, this.room.peerId, {})
        )
        break
      }
    }
  }

  private removePeer(peerId: string): void {
    this.peerManager.close(peerId)
    this.channelManager.closeChannel(peerId)
    this.peers.delete(peerId)
    this.onPeerLeftCbs.forEach(cb => cb(peerId))
    console.log(`[WebRTC] Peer removed: ${peerId}`)
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (!this.room) return
      const ping = buildPing(this.room.roomId, this.room.peerId)
      this.channelManager.broadcast(ping)

      const now = Date.now()
      for (const [peerId, peer] of this.peers) {
        if (now - peer.lastActive > PEER_TIMEOUT_MS) {
          console.log(`[WebRTC] Peer timed out: ${peerId}`)
          this.removePeer(peerId)
        }
      }
    }, PING_INTERVAL_MS)
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }
}

// Singleton — one WebRTC manager per browser session
export const webRTCManager = new WebRTCManager()