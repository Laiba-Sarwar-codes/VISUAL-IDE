// app/plugins/pwa.client.ts
// Production-only service worker registration. During Nuxt development we
// remove this app's previously installed workers/caches so Vite CSS and JS can
// never be served from a stale production cache.

import { defineNuxtPlugin } from '#app'
import { usePWAStore } from '~/stores/pwa'

const APP_CACHE_PREFIX = 'collab-ide-'

async function cleanDevelopmentPWAState(): Promise<void> {
  if (!('serviceWorker' in navigator)) return

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(
    registrations
      .filter(registration => registration.scope.startsWith(window.location.origin))
      .map(registration => registration.unregister())
  )

  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter(key => key.startsWith(APP_CACHE_PREFIX))
        .map(key => caches.delete(key))
    )
  }
}

export default defineNuxtPlugin(() => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  const pwa = usePWAStore()

  if (import.meta.env.DEV) {
    void cleanDevelopmentPWAState()
      .then(() => pwa.setRegistered(false))
      .catch(error => console.warn('[PWA] Development cleanup failed:', error))
    return
  }

  if (!import.meta.env.PROD) return

  let updateTimer: ReturnType<typeof setInterval> | null = null

  const handleControllerChange = (): void => {
    pwa.setUpdateAvailable(false)
  }

  navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then(registration => {
      pwa.setRegistered(true)

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            pwa.setUpdateAvailable(true)
          }
        })
      })

      updateTimer = setInterval(() => void registration.update(), 60_000)
    })
    .catch(error => {
      console.error('[PWA] Service Worker registration failed:', error)
      pwa.setRegistered(false)
    })

  const cleanup = (): void => {
    if (updateTimer) clearInterval(updateTimer)
    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
  }

  window.addEventListener('beforeunload', cleanup, { once: true })
  if (import.meta.hot) import.meta.hot.dispose(cleanup)
})
