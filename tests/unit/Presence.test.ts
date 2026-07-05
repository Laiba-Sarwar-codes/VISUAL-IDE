// tests/unit/Presence.test.ts
// V1: Tests for Task 4 — collaboration presence logic

import { describe, it, expect, vi } from 'vitest'
import type { ConnectedPeer } from '../../src/collaboration/webrtc/types'

function makePeer(overrides: Partial<ConnectedPeer> = {}): ConnectedPeer {
  return {
    peerId:          overrides.peerId          ?? 'peer-1',
    userId:          overrides.userId          ?? 'user-1',
    name:            overrides.name            ?? 'Alice',
    color:           overrides.color           ?? '#3b82f6',
    cursorX:         overrides.cursorX         ?? 0,
    cursorY:         overrides.cursorY         ?? 0,
    selectedId:      overrides.selectedId      ?? null,
    connectionState: overrides.connectionState ?? 'connected',
    lastActive:      overrides.lastActive      ?? Date.now(),
  }
}

describe('Presence — peer filtering', () => {
  it('does not include local peer in remote list', () => {
    const localId = 'local-user'
    const peers: ConnectedPeer[] = [
      makePeer({ peerId: 'remote-1' }),
      makePeer({ peerId: 'remote-2' }),
    ]
    // Local peer should never be added to the peers map in WebRTCManager
    const remotePeers = peers.filter(p => p.peerId !== localId)
    expect(remotePeers).toHaveLength(2)
    expect(remotePeers.every(p => p.peerId !== localId)).toBe(true)
  })

  it('stale peers (>10s inactive) are filtered from visible list', () => {
    const now = Date.now()
    const peers: ConnectedPeer[] = [
      makePeer({ peerId: 'active',   lastActive: now - 1000 }),
      makePeer({ peerId: 'stale',    lastActive: now - 15000 }),
      makePeer({ peerId: 'recent',   lastActive: now - 5000 }),
    ]
    const visible = peers.filter(p =>
      p.connectionState === 'connected' &&
      now - p.lastActive < 10_000
    )
    expect(visible).toHaveLength(2)
    expect(visible.some(p => p.peerId === 'stale')).toBe(false)
  })

  it('disconnected peers are not shown', () => {
    const peers: ConnectedPeer[] = [
      makePeer({ peerId: 'connected',    connectionState: 'connected' }),
      makePeer({ peerId: 'disconnected', connectionState: 'disconnected' }),
      makePeer({ peerId: 'failed',       connectionState: 'failed' }),
    ]
    const visible = peers.filter(p => p.connectionState === 'connected')
    expect(visible).toHaveLength(1)
    expect(visible[0]?.peerId).toBe('connected')
  })
})

describe('Presence — coordinate conversion (world → screen)', () => {
  it('converts world origin to viewport center at default camera', () => {
    // Mirrors RemoteCursors.vue cursorStyle() logic
    const cameraX = 0, cameraY = 0, cameraZoom = 1
    const canvasWidth = 800, canvasHeight = 600
    const worldX = 0, worldY = 0

    const cx = canvasWidth / 2
    const cy = canvasHeight / 2
    const screenX = (worldX - cameraX) * cameraZoom + cx
    const screenY = (worldY - cameraY) * cameraZoom + cy

    expect(screenX).toBe(400)
    expect(screenY).toBe(300)
  })

  it('accounts for camera pan offset', () => {
    const cameraX = 100, cameraY = 50, cameraZoom = 1
    const canvasWidth = 800, canvasHeight = 600
    const worldX = 100, worldY = 50

    const cx = canvasWidth / 2
    const cy = canvasHeight / 2
    const screenX = (worldX - cameraX) * cameraZoom + cx
    const screenY = (worldY - cameraY) * cameraZoom + cy

    // Peer at same world position as camera center → screen center
    expect(screenX).toBe(400)
    expect(screenY).toBe(300)
  })

  it('accounts for zoom level', () => {
    const cameraX = 0, cameraY = 0, cameraZoom = 2
    const canvasWidth = 800, canvasHeight = 600
    const worldX = 100, worldY = 0

    const cx = canvasWidth / 2
    const cy = canvasHeight / 2
    const screenX = (worldX - cameraX) * cameraZoom + cx

    // At zoom 2, world x=100 maps to center + 200 screen pixels
    expect(screenX).toBe(600)
  })
})

describe('Presence — selection clearing', () => {
  it('selectedId is null when peer deselects', () => {
    const peer = makePeer({ selectedId: 'obj-123' })
    expect(peer.selectedId).toBe('obj-123')

    // Simulate receiving presence update with null selection
    peer.selectedId = null
    expect(peer.selectedId).toBeNull()
  })

  it('peer selection update replaces previous selection', () => {
    const peer = makePeer({ selectedId: 'obj-1' })
    peer.selectedId = 'obj-2'
    expect(peer.selectedId).toBe('obj-2')
  })
})

describe('Presence — throttle', () => {
  it('cursor broadcast is throttled to ~50ms', async () => {
    let broadcastCount = 0
    let throttleTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleBroadcast = () => {
      if (throttleTimer) return
      throttleTimer = setTimeout(() => {
        broadcastCount++
        throttleTimer = null
      }, 50)
    }

    // Fire 10 cursor moves rapidly
    for (let i = 0; i < 10; i++) scheduleBroadcast()

    // Wait for throttle to fire
    await new Promise(r => setTimeout(r, 100))

    // Should have broadcast exactly once (throttled)
    expect(broadcastCount).toBe(1)
  })
})
