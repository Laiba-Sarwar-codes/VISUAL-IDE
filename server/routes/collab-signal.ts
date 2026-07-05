// server/routes/collab-signal.ts
// WebSocket signaling relay for WebRTC peer discovery.
//
// URL: ws://localhost:3000/collab-signal  (Nitro server/routes → path = filename)
//
// Why this file instead of a Nitro plugin:
//   nitroApp.hooks.hook('request:websocket') does NOT exist in Nitro 2.
//   nitroApp.router.add() exists but does not handle WebSocket upgrades.
//   The correct Nitro 2 / Nuxt 4 pattern is a file in server/routes/ that
//   exports defineWebSocketHandler() — Nitro auto-scans this directory and
//   registers the route with full WebSocket upgrade support via crossws.
//
// Protocol:
//   Clients send JSON SignalingMessage objects.
//   - type 'room:join'  → register peer, broadcast join to room
//   - type 'room:leave' → deregister peer, broadcast leave to room
//   - toPeerId set      → unicast to that peer
//   - no toPeerId       → broadcast to all other peers in the room
//
// crossws Peer API (Nitro 2 / H3 1.x):
//   peer.id          — unique connection id assigned by crossws
//   peer.context     — mutable Record<string,unknown> per connection
//   peer.send(data)  — send string/data to this peer
//   peer.peers       — Set<Peer> of ALL connected peers on the server
//   message.text()   — get message payload as string

import type { Peer, Message } from 'crossws'
import type { SignalingMessage } from '../../src/collaboration/webrtc/types'

// Per-peer context shape stored in peer.context
interface PeerContext {
  roomId?: string
  peerId?: string   // our app's peer id (nanoid), distinct from crossws peer.id
}

// Room map: roomId → Set of crossws Peer objects
const rooms = new Map<string, Set<Peer>>()

function roomKey(roomId: string): Set<Peer> {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set())
  return rooms.get(roomId)!
}

function addToRoom(roomId: string, peer: Peer): void {
  roomKey(roomId).add(peer)
}

function removeFromRoom(peer: Peer): void {
  const ctx = peer.context as PeerContext
  if (!ctx.roomId) return
  const room = rooms.get(ctx.roomId)
  if (!room) return
  room.delete(peer)
  if (room.size === 0) rooms.delete(ctx.roomId)
}

function broadcastToRoom(roomId: string, msg: SignalingMessage, excludePeer: Peer): void {
  const room = rooms.get(roomId)
  if (!room) return
  const data = JSON.stringify(msg)
  for (const p of room) {
    if (p !== excludePeer) {
      try { p.send(data) } catch { /* peer already closed */ }
    }
  }
}

function sendToPeer(roomId: string, toPeerId: string, msg: SignalingMessage): void {
  const room = rooms.get(roomId)
  if (!room) return
  const data = JSON.stringify(msg)
  for (const p of room) {
    const ctx = p.context as PeerContext
    if (ctx.peerId === toPeerId) {
      try { p.send(data) } catch { /* peer already closed */ }
      return
    }
  }
}

export default defineWebSocketHandler({
  open(peer: Peer) {
    console.log(`[Signal] connection opened: ${peer.id}`)
  },

  message(peer: Peer, message: Message) {
    let msg: SignalingMessage
    try {
      msg = JSON.parse(message.text()) as SignalingMessage
    } catch {
      return
    }

    const { type, roomId, fromPeerId, toPeerId } = msg
    const ctx = peer.context as PeerContext

    if (type === 'room:join') {
      if (ctx.roomId) removeFromRoom(peer)
      ctx.roomId = roomId
      ctx.peerId = fromPeerId
      addToRoom(roomId, peer)
      const size = rooms.get(roomId)?.size ?? 0
      console.log(`[Signal] ${fromPeerId} joined room ${roomId} (${size} peers total)`)
      broadcastToRoom(roomId, msg, peer)
      return
    }

    if (!ctx.roomId) {
      ctx.roomId = roomId
      ctx.peerId = fromPeerId
      addToRoom(roomId, peer)
    }

    if (type === 'room:leave') {
      broadcastToRoom(roomId, msg, peer)
      removeFromRoom(peer)
      ctx.roomId = undefined
      ctx.peerId = undefined
      console.log(`[Signal] ${fromPeerId} left room ${roomId}`)
      return
    }

    if (toPeerId) {
      sendToPeer(roomId, toPeerId, msg)
    } else {
      broadcastToRoom(roomId, msg, peer)
    }
  },

  close(peer: Peer) {
    const ctx = peer.context as PeerContext
    if (ctx.roomId && ctx.peerId) {
      const leaveMsg: SignalingMessage = {
        type: 'room:leave',
        roomId: ctx.roomId,
        fromPeerId: ctx.peerId,
      }
      broadcastToRoom(ctx.roomId, leaveMsg, peer)
      removeFromRoom(peer)
      console.log(`[Signal] ${ctx.peerId} disconnected from room ${ctx.roomId}`)
    }
    console.log(`[Signal] connection closed: ${peer.id}`)
  },

  error(peer: Peer, error: unknown) {
    console.error(`[Signal] error on ${peer.id}:`, error)
  },
})