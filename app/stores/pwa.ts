// app/stores/pwa.ts
// Module 23 — reactive PWA state

import { defineStore } from 'pinia'

interface PWAState {
  isRegistered: boolean
  isUpdateAvailable: boolean
  isInstallable: boolean
  isInstalled: boolean
}

export const usePWAStore = defineStore('pwa', {
  state: (): PWAState => ({
    isRegistered:      false,
    isUpdateAvailable: false,
    isInstallable:     false,
    isInstalled:       false,
  }),

  getters: {
    displayMode(): 'standalone' | 'browser' {
      if (typeof window === 'undefined') return 'browser'
      return window.matchMedia('(display-mode: standalone)').matches
        ? 'standalone'
        : 'browser'
    },
  },

  actions: {
    setRegistered(value: boolean):      void { this.isRegistered = value },
    setUpdateAvailable(value: boolean): void { this.isUpdateAvailable = value },
    setInstallable(value: boolean):     void { this.isInstallable = value },

    /**
     * Why: tells the active service worker to skip waiting and take
     * control immediately. The page will reload automatically when the
     * new SW fires the controllerchange event (handled in pwa.client.ts).
     */
    applyUpdate(): void {
      if (typeof navigator === 'undefined') return
      if (!('serviceWorker' in navigator)) return
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    },
  },
})