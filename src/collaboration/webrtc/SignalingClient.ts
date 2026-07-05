// src/collaboration/webrtc/SignalingClient.ts
// Module 15 — signaling abstraction (swappable)

import type { SignalingMessage } from './types'

export type SignalingHandler = (msg: SignalingMessage) => void

export interface ISignalingClient {
  connect(roomId: string, peerId: string): Promise<void>
  disconnect(): void
  send(msg: SignalingMessage): void
  onMessage(handler: SignalingHandler): void
  offMessage(handler: SignalingHandler): void
}

/**
 * WebSocket signaling client.
 *
 * In production it connects to the same-origin Nitro WebSocket route at
 * /collab-signal, so one Node deployment serves both the Nuxt application
 * and room signaling. During local Nuxt development it uses the standalone
 * signaling server on port 4747 because Vite owns the dev-server upgrade
 * listener. VITE_SIGNALING_URL can override either behavior at build time.
 */
export class WebSocketSignaling implements ISignalingClient {
  private ws: WebSocket | null = null
  private handlers: Set<SignalingHandler> = new Set()
  private peerId = ''
  private roomId = ''
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 500
  private readonly maxDelay = 16_000
  private intentionalClose = false

  /** Resolve the signaling server for local development or production. */
  private signalingUrl(): string {
    const configured = import.meta.env.VITE_SIGNALING_URL?.trim()
    if (configured) return configured.replace(/\/$/, '')

    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    if (import.meta.env.DEV) {
      return `${proto}://${location.hostname}:4747`
    }

    return `${proto}://${location.host}/collab-signal`
  }

  async connect(roomId: string, peerId: string): Promise<void> {
    this.roomId = roomId
    this.peerId = peerId
    this.intentionalClose = false
    this.reconnectDelay = 500

    return new Promise<void>((resolve, reject) => {
      this._open(resolve, reject)
    })
  }

  private _open(
    onOpen?: (() => void) | null,
    onError?: ((e: unknown) => void) | null
  ): void {
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      try { this.ws.close() } catch { /* ignore */ }
      this.ws = null
    }

    const url = this.signalingUrl()
    console.log(`[SignalingWS] Connecting to ${url}`)

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[SignalingWS] Failed to create WebSocket: ${msg}`)
      onError?.(new Error(`WebSocket construction failed: ${msg}`))
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.reconnectDelay = 500
      console.log(`[SignalingWS] Connected to ${url}`)
      this.send({
        type: 'room:join',
        roomId: this.roomId,
        fromPeerId: this.peerId,
      })
      onOpen?.()
      onOpen = null
      onError = null
    }

    ws.onmessage = (e: MessageEvent<string>) => {
      let msg: SignalingMessage
      try {
        msg = JSON.parse(e.data) as SignalingMessage
      } catch {
        return
      }
      if (msg.fromPeerId === this.peerId) return
      if (msg.toPeerId && msg.toPeerId !== this.peerId) return
      this.handlers.forEach(h => h(msg))
    }

    ws.onclose = (ev) => {
      this.ws = null
      // If onOpen was never called the connect() Promise must reject
      if (onError) {
        const reason = ev.reason
          ? ev.reason
          : ev.code === 1006
            ? import.meta.env.DEV
              ? 'Could not reach the local signaling server. Run "npm run dev:with-signaling" instead of "npm run dev".'
              : 'Could not reach the deployed signaling route. Confirm the app is deployed as a Node Web Service with WebSocket support.'
            : `code ${ev.code}`
        const err = new Error(`Signaling connection failed: ${reason}`)
        console.error('[SignalingWS]', err.message)
        onError(err)
        onOpen = null
        onError = null
        return
      }
      if (this.intentionalClose) return
      const delay = this.reconnectDelay
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay)
      console.log(`[SignalingWS] Disconnected — reconnecting in ${delay}ms`)
      this.reconnectTimer = setTimeout(() => {
        this._open(null, null)
      }, delay)
    }

    ws.onerror = () => {
      // Rejection is handled in onclose which always fires after onerror
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.send({
        type: 'room:leave',
        roomId: this.roomId,
        fromPeerId: this.peerId,
      })
      try { this.ws.close() } catch { /* ignore */ }
      this.ws = null
    }
    this.handlers.clear()
  }

  send(msg: SignalingMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg))
      } catch (err) {
        console.warn('[SignalingWS] Send failed:', err)
      }
    }
  }

  onMessage(handler: SignalingHandler): void { this.handlers.add(handler) }
  offMessage(handler: SignalingHandler): void { this.handlers.delete(handler) }
}

/**
 * BroadcastChannel — kept for unit tests only.
 * Does NOT work between normal and incognito browser windows.
 */
export class BroadcastChannelSignaling implements ISignalingClient {
  private channel: BroadcastChannel | null = null
  private handlers: Set<SignalingHandler> = new Set()
  private peerId = ''
  private roomId = ''

  async connect(roomId: string, peerId: string): Promise<void> {
    this.roomId = roomId
    this.peerId = peerId
    this.channel = new BroadcastChannel(`collab-room-${roomId}`)
    this.channel.onmessage = (e: MessageEvent<SignalingMessage>) => {
      const msg = e.data
      if (msg.fromPeerId === this.peerId) return
      if (msg.toPeerId && msg.toPeerId !== this.peerId) return
      this.handlers.forEach(h => h(msg))
    }
    this.send({ type: 'room:join', roomId, fromPeerId: peerId })
  }

  disconnect(): void {
    if (this.channel) {
      this.send({ type: 'room:leave', roomId: this.roomId, fromPeerId: this.peerId })
      this.channel.close()
      this.channel = null
    }
    this.handlers.clear()
  }

  send(msg: SignalingMessage): void { this.channel?.postMessage(msg) }
  onMessage(handler: SignalingHandler): void { this.handlers.add(handler) }
  offMessage(handler: SignalingHandler): void { this.handlers.delete(handler) }
}