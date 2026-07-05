// src/collaboration/webrtc/MessageProtocol.ts
// Module 15 — message building and validation

import { nanoid } from 'nanoid'
import type {
  PeerMessage,
  MessageType,
  CRDTUpdatePayload,
  PresencePayload,
  SyncResponsePayload,
} from './types'

/**
 * Why: all outgoing messages are built here so every message
 * is guaranteed to have the correct shape. Callers never
 * construct raw objects — they call typed builder functions.
 */
export function buildMessage(
  type: MessageType,
  roomId: string,
  peerId: string,
  payload: Record<string, unknown>
): PeerMessage {
  return { type, roomId, peerId, timestamp: Date.now(), payload }
}

export function buildCRDTUpdate(
  roomId: string,
  peerId: string,
  update: Uint8Array
): PeerMessage {
  const payload: CRDTUpdatePayload = {
    update: Array.from(update),
    updateId: nanoid(),
  }
  return buildMessage('crdt:update', roomId, peerId, payload as unknown as Record<string, unknown>)
}

export function buildPresenceUpdate(
  roomId: string,
  peerId: string,
  presence: PresencePayload
): PeerMessage {
  return buildMessage('presence:update', roomId, peerId, presence as unknown as Record<string, unknown>)
}

export function buildSyncResponse(
  roomId: string,
  peerId: string,
  update: Uint8Array
): PeerMessage {
  const payload: SyncResponsePayload = { update: Array.from(update) }
  return buildMessage('sync:response', roomId, peerId, payload as unknown as Record<string, unknown>)
}

export function buildPing(roomId: string, peerId: string): PeerMessage {
  return buildMessage('ping', roomId, peerId, {})
}

/**
 * Why: all incoming messages from peers pass through here before
 * any handler touches them. Invalid messages are silently dropped
 * so a misbehaving peer cannot crash the local editor.
 */
export function parseMessage(raw: string): PeerMessage | null {
  try {
    const msg = JSON.parse(raw) as unknown

    if (!isValidMessage(msg)) {
      console.warn('[MessageProtocol] Invalid message received:', raw.slice(0, 100))
      return null
    }

    return msg
  } catch {
    console.warn('[MessageProtocol] Failed to parse message')
    return null
  }
}

function isValidMessage(msg: unknown): msg is PeerMessage {
  if (typeof msg !== 'object' || msg === null) return false
  const m = msg as Record<string, unknown>
  return (
    typeof m.type === 'string' &&
    typeof m.roomId === 'string' &&
    typeof m.peerId === 'string' &&
    typeof m.timestamp === 'number' &&
    typeof m.payload === 'object' &&
    m.payload !== null
  )
}

export function serializeMessage(msg: PeerMessage): string {
  return JSON.stringify(msg)
}