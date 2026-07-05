// src/collaboration/webrtc/types.ts
// Module 15 — WebRTC collaboration type definitions

// RTCPeerConnectionState is a DOM type not available in the Nitro server
// tsconfig context. We replicate the string union here so the types work
// in both browser and server compilation units.
export type RTCPeerConnectionStateValue =
  | 'closed'
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'failed'
  | 'new'

export type MessageType =
  | 'crdt:update'
  | 'presence:update'
  | 'cursor:move'
  | 'selection:update'
  | 'user:joined'
  | 'user:left'
  | 'sync:request'
  | 'sync:response'
  | 'ping'
  | 'pong'

export interface PeerMessage {
  type: MessageType
  roomId: string
  peerId: string
  timestamp: number
  payload: Record<string, unknown>
}

export interface CRDTUpdatePayload {
  update: number[]   // Uint8Array serialized as number[] for JSON
  updateId: string   // deduplication id
}

export interface PresencePayload {
  userId: string
  name: string
  color: string
  cursorX: number
  cursorY: number
  selectedId: string | null
  lastActive: number
}

export interface SyncResponsePayload {
  update: number[]   // full Yjs state as number[]
}

export interface ConnectedPeer {
  peerId: string
  userId: string
  name: string
  color: string
  cursorX: number
  cursorY: number
  selectedId: string | null
  connectionState: RTCPeerConnectionStateValue | 'signaling'
  lastActive: number
}

// ── Signaling message types ────────────────────────────────────────────

export type SignalingMessageType =
  | 'room:join'
  | 'room:leave'
  | 'peer:joined'
  | 'peer:left'
  | 'offer'
  | 'answer'
  | 'ice:candidate'

export interface SignalingMessage {
  type: SignalingMessageType
  roomId: string
  fromPeerId: string
  toPeerId?: string     // undefined = broadcast to room
  payload?: unknown
}

export interface RoomInfo {
  roomId: string
  peerId: string        // local peer's id
  userId: string
  name: string
  color: string
}