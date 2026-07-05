// app/stores/offline.ts
// Module 16 — reactive offline state, SSR-safe init

import { defineStore } from 'pinia'
import { networkStatus } from '~~/src/offline/NetworkStatusService'
import { offlineQueue } from '~~/src/offline/OfflineQueue'
import type { NetworkStatus } from '~~/src/offline/types'

interface OfflineState {
  networkStatus: NetworkStatus
  queueLength: number
  lastSyncedAt: number | null
  syncError: string | null
}

export const useOfflineStore = defineStore('offline', {
  state: (): OfflineState => ({
    networkStatus: 'online',        // SSR-safe default
    queueLength: 0,
    lastSyncedAt: null,
    syncError: null,
  }),

  getters: {
    isOnline: (state) => state.networkStatus === 'online',
    isOffline: (state) => state.networkStatus === 'offline',
    isReconnecting: (state) => state.networkStatus === 'reconnecting',
    hasQueuedOps: (state) => state.queueLength > 0,

    statusLabel: (state): string => {
      switch (state.networkStatus) {
        case 'online':
          return state.queueLength > 0 ? `Syncing ${state.queueLength} ops…` : 'Online'
        case 'offline':
          return state.queueLength > 0
            ? `Offline — ${state.queueLength} queued`
            : 'Offline'
        case 'reconnecting':
          return 'Reconnecting…'
      }
    },

    statusColor: (state): string => {
      switch (state.networkStatus) {
        case 'online':       return state.queueLength > 0 ? '#f59e0b' : '#22c55e'
        case 'offline':      return '#ef4444'
        case 'reconnecting': return '#f59e0b'
      }
    },
  },

  actions: {
    /**
     * Why: guarded with typeof window so SSR never touches localStorage
     * or navigator. The composable calls this in onMounted (client-only),
     * but the extra guard means even accidental SSR calls are safe.
     */
    init(): void {
      if (typeof window === 'undefined') return

      offlineQueue.load()
      this.queueLength = offlineQueue.length
      this.networkStatus = networkStatus.currentStatus

      networkStatus.onChange((status: NetworkStatus) => {
        this.networkStatus = status
      })

      networkStatus.start()
    },

    syncQueueLength(): void {
      this.queueLength = offlineQueue.length
    },

    setLastSynced(): void {
      this.lastSyncedAt = Date.now()
      this.syncError = null
    },

    setSyncError(msg: string): void {
      this.syncError = msg
    },
  },
})