// src/offline/NetworkStatusService.ts
// Module 16 — SSR-safe network status detection

import type { NetworkStatus } from './types'

type StatusHandler = (status: NetworkStatus) => void

/**
 * Why: this class must not touch `navigator`, `window`, or any browser
 * API during module load or class-property initialization, because Nuxt
 * imports and instantiates modules during SSR where those globals don't
 * exist. All browser access is deferred to start(), which is only ever
 * called from the client-side onMounted hook in useOffline().
 */
export class NetworkStatusService {
  private status: NetworkStatus = 'online'
  private handlers: Set<StatusHandler> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private started = false

  constructor() {
    // No browser API access here — safe during SSR
  }

  /**
   * Why: called from useOffline composable during onMounted, guaranteed
   * to be on the client. This is where we finally read navigator.onLine
   * and register window event listeners.
   */
  start(): void {
    if (this.started) return
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return

    this.started = true
    this.status = navigator.onLine ? 'online' : 'offline'

    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)

    console.log(`[Network] Started — status: ${this.status}`)
  }

  stop(): void {
    if (typeof window === 'undefined') return
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.handlers.clear()
    this.started = false
  }

  get currentStatus(): NetworkStatus { return this.status }
  get isOnline(): boolean { return this.status === 'online' }
  get isOffline(): boolean { return this.status === 'offline' }

  onChange(handler: StatusHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  private handleOnline = (): void => {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.setStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.setStatus('online')
      console.log('[Network] Back online')
    }, 1500)
  }

  private handleOffline = (): void => {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.setStatus('offline')
    console.log('[Network] Gone offline')
  }

  private setStatus(status: NetworkStatus): void {
    this.status = status
    this.handlers.forEach(h => h(status))
  }
}

export const networkStatus = new NetworkStatusService()