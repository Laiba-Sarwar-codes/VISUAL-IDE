// src/collaboration/webrtc/PeerConnectionManager.ts
// Module 15 — manages RTCPeerConnection instances per peer

import type { RTCPeerConnectionStateValue } from './types'
import { createRTCConfiguration } from './rtcConfig'

export type ICECandidateHandler = (peerId: string, candidate: RTCIceCandidate) => void
export type ConnectionStateHandler = (peerId: string, state: RTCPeerConnectionStateValue) => void
export type DataChannelHandler = (peerId: string, channel: RTCDataChannel) => void

export class PeerConnectionManager {
  private connections = new Map<string, RTCPeerConnection>()

  private onICECandidate?: ICECandidateHandler
  private onConnectionStateChange?: ConnectionStateHandler
  private onDataChannel?: DataChannelHandler

  setHandlers(handlers: {
    onICECandidate?: ICECandidateHandler
    onConnectionStateChange?: ConnectionStateHandler
    onDataChannel?: DataChannelHandler
  }): void {
    this.onICECandidate = handlers.onICECandidate
    this.onConnectionStateChange = handlers.onConnectionStateChange
    this.onDataChannel = handlers.onDataChannel
  }

  /**
   * Why: creates a new RTCPeerConnection for a peer and wires up all
   * the standard WebRTC events. Each peer gets its own connection
   * instance so peers are fully independent — one disconnecting doesn't
   * affect others.
   */
  create(peerId: string): RTCPeerConnection {
    this.close(peerId) // clean up any existing connection first

    const pc = new RTCPeerConnection(createRTCConfiguration())

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.onICECandidate?.(peerId, e.candidate)
      }
    }

    pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(
        peerId,
        pc.connectionState as RTCPeerConnectionStateValue
      )
    }

    pc.ondatachannel = (e) => {
      this.onDataChannel?.(peerId, e.channel)
    }

    this.connections.set(peerId, pc)
    return pc
  }

  get(peerId: string): RTCPeerConnection | undefined {
    return this.connections.get(peerId)
  }

  getAll(): Map<string, RTCPeerConnection> {
    return this.connections
  }

  /**
   * Why: gracefully closes the peer connection and removes it from
   * the map. Called when a peer leaves or times out.
   */
  close(peerId: string): void {
    const pc = this.connections.get(peerId)
    if (pc) {
      pc.onicecandidate = null
      pc.onconnectionstatechange = null
      pc.ondatachannel = null
      pc.close()
      this.connections.delete(peerId)
    }
  }

  closeAll(): void {
    for (const peerId of this.connections.keys()) {
      this.close(peerId)
    }
  }

  getConnectionState(peerId: string): RTCPeerConnectionStateValue | 'none' {
    return (
      (this.connections.get(peerId)?.connectionState as RTCPeerConnectionStateValue | undefined)
      ?? 'none'
    )
  }

  isConnected(peerId: string): boolean {
    return this.getConnectionState(peerId) === 'connected'
  }
}