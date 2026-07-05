import { nanoid } from 'nanoid'
import type { CRDTService } from '../../collaboration/CRDTService'
import { createRTCConfiguration } from '../../collaboration/webrtc/rtcConfig'
import {
  decodeManualSignal,
  encodeManualSignal,
  type ManualSignalToken,
} from './ManualSignalingToken'

export type ManualConnectionState = 'idle' | 'connecting' | 'connected' | 'failed' | 'closed'

interface ManualPeerMessage {
  type: 'sync' | 'update' | 'ping' | 'pong'
  update?: number[]
  timestamp: number
}

/**
 * Backend-free cross-device signaling using copy/paste SDP tokens.
 *
 * The offerer copies one token to the answering device. The answering device
 * returns one answer token. ICE candidates are gathered into the SDP before a
 * token is created, so no trickle-candidate exchange is required.
 */
export class ManualCollaborationSession {
  private connection: RTCPeerConnection | null = null
  private channel: RTCDataChannel | null = null
  private stopCRDTListener: (() => void) | null = null
  private applyingRemote = false
  private readonly listeners = new Set<(state: ManualConnectionState) => void>()
  private state: ManualConnectionState = 'idle'
  private sessionId = nanoid()
  private readonly peerId = nanoid()

  constructor(private readonly crdt: CRDTService) {}

  get connectionState(): ManualConnectionState { return this.state }

  onStateChange(listener: (state: ManualConnectionState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async createOfferToken(): Promise<string> {
    this.resetConnection()
    this.setState('connecting')
    this.sessionId = nanoid()
    const connection = this.createConnection()
    this.attachChannel(connection.createDataChannel('collab-priority2', { ordered: true }))

    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer)
    await waitForIceGathering(connection)
    const description = connection.localDescription
    if (!description) throw new Error('WebRTC did not produce an offer description.')

    return encodeManualSignal({
      version: 1,
      type: 'offer',
      sessionId: this.sessionId,
      peerId: this.peerId,
      description: description.toJSON(),
      createdAt: Date.now(),
    })
  }

  async acceptOfferToken(encodedOffer: string): Promise<string> {
    const token = decodeManualSignal(encodedOffer)
    if (token.type !== 'offer') throw new Error('Expected an offer token.')

    this.resetConnection()
    this.setState('connecting')
    this.sessionId = token.sessionId
    const connection = this.createConnection()
    await connection.setRemoteDescription(token.description)
    const answer = await connection.createAnswer()
    await connection.setLocalDescription(answer)
    await waitForIceGathering(connection)
    const description = connection.localDescription
    if (!description) throw new Error('WebRTC did not produce an answer description.')

    return encodeManualSignal({
      version: 1,
      type: 'answer',
      sessionId: token.sessionId,
      peerId: this.peerId,
      description: description.toJSON(),
      createdAt: Date.now(),
    })
  }

  async applyAnswerToken(encodedAnswer: string): Promise<void> {
    const token = decodeManualSignal(encodedAnswer)
    if (token.type !== 'answer') throw new Error('Expected an answer token.')
    if (token.sessionId !== this.sessionId) throw new Error('The answer belongs to a different session.')
    if (!this.connection) throw new Error('Create an offer before applying an answer.')
    // Negotiation already completed (e.g. a duplicate submit after a
    // successful connect) — setRemoteDescription would throw
    // InvalidStateError since there is no pending offer/answer exchange.
    if (this.connection.signalingState === 'stable') return
    await this.connection.setRemoteDescription(token.description)
  }

  close(): void {
    this.resetConnection()
    this.setState('closed')
  }

  private createConnection(): RTCPeerConnection {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('This browser does not support WebRTC.')
    }

    const connection = new RTCPeerConnection(createRTCConfiguration())
    connection.ondatachannel = (event) => this.attachChannel(event.channel)
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') this.setState('connected')
      if (connection.connectionState === 'failed') this.setState('failed')
      if (connection.connectionState === 'closed') this.setState('closed')
      if (connection.connectionState === 'disconnected') this.setState('failed')
    }
    this.connection = connection
    return connection
  }

  private attachChannel(channel: RTCDataChannel): void {
    this.channel = channel
    channel.onopen = () => {
      this.setState('connected')
      this.startCRDTSync()
      this.sendFullState()
    }
    channel.onmessage = (event: MessageEvent<string>) => this.handleMessage(event.data)
    channel.onerror = () => this.setState('failed')
    channel.onclose = () => this.setState('closed')
  }

  private startCRDTSync(): void {
    this.stopCRDTListener?.()
    this.stopCRDTListener = this.crdt.onUpdate((update) => {
      if (this.applyingRemote) return
      this.send({ type: 'update', update: Array.from(update), timestamp: Date.now() })
    })
  }

  private sendFullState(): void {
    const update = this.crdt.export()
    if (!update) return
    this.send({ type: 'sync', update: Array.from(update), timestamp: Date.now() })
  }

  private handleMessage(raw: string): void {
    let message: ManualPeerMessage
    try {
      message = JSON.parse(raw) as ManualPeerMessage
    } catch {
      return
    }

    if ((message.type === 'sync' || message.type === 'update') && Array.isArray(message.update)) {
      const update = new Uint8Array(message.update)
      this.applyingRemote = true
      try {
        if (!this.crdt.isInitialized && message.type === 'sync') {
          this.crdt.load(update, 'Shared Project')
        } else {
          this.crdt.applyRemoteUpdate(update)
        }
      } finally {
        this.applyingRemote = false
      }
      return
    }

    if (message.type === 'ping') {
      this.send({ type: 'pong', timestamp: Date.now() })
    }
  }

  private send(message: ManualPeerMessage): void {
    if (this.channel?.readyState !== 'open') return
    this.channel.send(JSON.stringify(message))
  }

  private resetConnection(): void {
    this.stopCRDTListener?.()
    this.stopCRDTListener = null
    if (this.channel) {
      this.channel.onopen = null
      this.channel.onmessage = null
      this.channel.onerror = null
      this.channel.onclose = null
      this.channel.close()
      this.channel = null
    }
    if (this.connection) {
      this.connection.ondatachannel = null
      this.connection.onconnectionstatechange = null
      this.connection.close()
      this.connection = null
    }
  }

  private setState(state: ManualConnectionState): void {
    if (this.state === state) return
    this.state = state
    for (const listener of this.listeners) listener(state)
  }
}

async function waitForIceGathering(connection: RTCPeerConnection, timeoutMs = 8000): Promise<void> {
  if (connection.iceGatheringState === 'complete') return

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(finish, timeoutMs)
    function finish(): void {
      clearTimeout(timeout)
      connection.removeEventListener('icegatheringstatechange', handleChange)
      resolve()
    }
    function handleChange(): void {
      if (connection.iceGatheringState === 'complete') finish()
    }
    connection.addEventListener('icegatheringstatechange', handleChange)
  })
}

export type { ManualSignalToken }
