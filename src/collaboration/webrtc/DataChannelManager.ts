// src/collaboration/webrtc/DataChannelManager.ts
// Module 15 — manages RTCDataChannel instances per peer

import { parseMessage, serializeMessage } from './MessageProtocol'
import type { PeerMessage } from './types'

export type MessageHandler = (peerId: string, msg: PeerMessage) => void
export type ChannelStateHandler = (peerId: string, state: 'open' | 'closed' | 'error') => void

const CHANNEL_LABEL = 'collab'

export class DataChannelManager {
  private channels = new Map<string, RTCDataChannel>()
  private messageHandlers: Set<MessageHandler> = new Set()
  private stateHandlers: Set<ChannelStateHandler> = new Set()

  onMessage(handler: MessageHandler): void { this.messageHandlers.add(handler) }
  offMessage(handler: MessageHandler): void { this.messageHandlers.delete(handler) }
  onStateChange(handler: ChannelStateHandler): void { this.stateHandlers.add(handler) }

  /**
   * Why: the initiating peer (the one who sent the offer) creates the
   * data channel. The receiving peer gets it via pc.ondatachannel.
   * Using ordered:true, reliable:true ensures CRDT updates arrive in
   * order and never drop — critical for correct CRDT merge behavior.
   */
  createChannel(peerId: string, pc: RTCPeerConnection): RTCDataChannel {
    const channel = pc.createDataChannel(CHANNEL_LABEL, {
      ordered: true,
    })
    this.wireChannel(peerId, channel)
    return channel
  }

  /**
   * Why: receiving peers get channels via ondatachannel event, not by
   * creating them. We wire the same handlers regardless of which side
   * created the channel so behavior is symmetric.
   */
  registerChannel(peerId: string, channel: RTCDataChannel): void {
    this.wireChannel(peerId, channel)
  }

  /**
   * Why: attaches open/close/error/message handlers to a channel.
   * Incoming messages go through parseMessage() which validates and
   * drops malformed data before any handler sees it.
   */
  private wireChannel(peerId: string, channel: RTCDataChannel): void {
    this.channels.set(peerId, channel)

    channel.onopen = () => {
      console.log(`[DataChannel] Open with peer: ${peerId}`)
      this.stateHandlers.forEach(h => h(peerId, 'open'))
    }

    channel.onclose = () => {
      console.log(`[DataChannel] Closed with peer: ${peerId}`)
      this.channels.delete(peerId)
      this.stateHandlers.forEach(h => h(peerId, 'closed'))
    }

    channel.onerror = (e) => {
      console.error(`[DataChannel] Error with peer: ${peerId}`, e)
      this.stateHandlers.forEach(h => h(peerId, 'error'))
    }

    channel.onmessage = (e: MessageEvent<string>) => {
      const msg = parseMessage(e.data)
      if (!msg) return
      this.messageHandlers.forEach(h => h(peerId, msg))
    }
  }

  /**
   * Why: sends a message to one specific peer. Checks channel is open
   * before sending to avoid throwing on a closed/connecting channel.
   */
  sendToPeer(peerId: string, msg: PeerMessage): void {
    const channel = this.channels.get(peerId)
    if (!channel || channel.readyState !== 'open') return
    try {
      channel.send(serializeMessage(msg))
    } catch (err) {
      console.error(`[DataChannel] Send failed to ${peerId}:`, err)
    }
  }

  /**
   * Why: broadcasts to all connected peers. Used for CRDT updates and
   * presence changes that all peers need to receive.
   */
  broadcast(msg: PeerMessage): void {
    for (const [peerId, channel] of this.channels) {
      if (channel.readyState === 'open') {
        try {
          channel.send(serializeMessage(msg))
        } catch (err) {
          console.error(`[DataChannel] Broadcast failed to ${peerId}:`, err)
        }
      }
    }
  }

  closeChannel(peerId: string): void {
    const channel = this.channels.get(peerId)
    if (channel) {
      channel.onopen = null
      channel.onclose = null
      channel.onerror = null
      channel.onmessage = null
      channel.close()
      this.channels.delete(peerId)
    }
  }

  closeAll(): void {
    for (const peerId of [...this.channels.keys()]) {
      this.closeChannel(peerId)
    }
  }

  getOpenPeers(): string[] {
    return [...this.channels.entries()]
      .filter(([, ch]) => ch.readyState === 'open')
      .map(([id]) => id)
  }

  isOpen(peerId: string): boolean {
    return this.channels.get(peerId)?.readyState === 'open'
  }
}