// scripts/signaling-server.mjs
// Standalone WebSocket signaling relay server.
// Runs on port 4747 alongside the Nuxt dev server.
//
// Why standalone and not inside Nitro:
//   In Nuxt 4 dev mode, Vite registers an HTTP "upgrade" listener on the
//   shared dev server BEFORE Nitro. For non-vite-hmr WebSocket connections
//   Vite's listener returns without doing anything AND without passing the
//   socket onward, so Nitro's upgrade handler never fires. The result is
//   an abnormal close (code 1006) on every browser WebSocket connection.
//
//   Running a separate ws server on port 4747 sidesteps this entirely.
//   The browser connects to ws://localhost:4747 which has no Vite layer.
//
// Start: node scripts/signaling-server.mjs
// (called automatically by `npm run dev:with-signaling` — plain `npm run
// dev` does NOT start this, since the app is backend-free by default)

import { WebSocketServer } from 'ws'

const PORT = Number(process.env.SIGNALING_PORT || 4747)
const HOST = process.env.SIGNALING_HOST || '0.0.0.0'

// Room map: roomId → Map<peerId, WebSocket>
const rooms = new Map()

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Map())
  return rooms.get(roomId)
}

function addPeer(roomId, peerId, ws) {
  getRoom(roomId).set(peerId, ws)
}

function removePeer(roomId, peerId) {
  const room = rooms.get(roomId)
  if (!room) return
  room.delete(peerId)
  if (room.size === 0) rooms.delete(roomId)
}

function safeSend(ws, msg) {
  try {
    if (ws.readyState === 1 /* OPEN */) ws.send(JSON.stringify(msg))
  } catch { /* ignore */ }
}

function broadcastToRoom(roomId, msg, excludePeerId) {
  const room = rooms.get(roomId)
  if (!room) return
  for (const [peerId, ws] of room) {
    if (peerId !== excludePeerId) safeSend(ws, msg)
  }
}

function sendToPeer(roomId, toPeerId, msg) {
  const room = rooms.get(roomId)
  if (!room) return
  const ws = room.get(toPeerId)
  if (ws) safeSend(ws, msg)
}

const wss = new WebSocketServer({ port: PORT, host: HOST })

wss.on('listening', () => {
  console.log(`[Signal] Signaling server listening on ws://${HOST}:${PORT}`)
})

wss.on('connection', (ws) => {
  let registeredRoom = ''
  let registeredPeer = ''

  ws.on('message', (data) => {
    let msg
    try { msg = JSON.parse(data.toString()) }
    catch { return }

    const { type, roomId, fromPeerId, toPeerId } = msg
    if (!type || !roomId || !fromPeerId) return

    if (type === 'room:join') {
      // Clean up previous room if switching
      if (registeredRoom && registeredPeer) {
        removePeer(registeredRoom, registeredPeer)
      }
      registeredRoom = roomId
      registeredPeer = fromPeerId
      addPeer(roomId, fromPeerId, ws)
      const size = rooms.get(roomId)?.size ?? 0
      console.log(`[Signal] ${fromPeerId} joined room ${roomId} (${size} peer(s))`)
      broadcastToRoom(roomId, msg, fromPeerId)
      return
    }

    // Auto-register on first non-join message
    if (!registeredPeer) {
      registeredRoom = roomId
      registeredPeer = fromPeerId
      addPeer(roomId, fromPeerId, ws)
    }

    if (type === 'room:leave') {
      broadcastToRoom(roomId, msg, fromPeerId)
      removePeer(roomId, fromPeerId)
      registeredRoom = ''
      registeredPeer = ''
      console.log(`[Signal] ${fromPeerId} left room ${roomId}`)
      return
    }

    // Route message
    if (toPeerId) {
      sendToPeer(roomId, toPeerId, msg)
    } else {
      broadcastToRoom(roomId, msg, fromPeerId)
    }
  })

  ws.on('close', () => {
    if (registeredRoom && registeredPeer) {
      const leaveMsg = { type: 'room:leave', roomId: registeredRoom, fromPeerId: registeredPeer }
      broadcastToRoom(registeredRoom, leaveMsg, registeredPeer)
      removePeer(registeredRoom, registeredPeer)
      console.log(`[Signal] ${registeredPeer} disconnected from room ${registeredRoom}`)
    }
  })

  ws.on('error', (err) => {
    console.error('[Signal] peer error:', err.message)
  })
})

wss.on('error', (err) => {
  console.error('[Signal] server error:', err.message)
})

// Keep process alive
process.on('SIGINT', () => { wss.close(); process.exit(0) })
process.on('SIGTERM', () => { wss.close(); process.exit(0) })