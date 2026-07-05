// public/sw.js
// Production service worker. Nuxt/Vite development modules are explicitly
// excluded because they are virtual, mutable resources and must never be
// served cache-first.

const CACHE_PREFIX = 'collab-ide-'
const CACHE_NAME = `${CACHE_PREFIX}v3`
const OFFLINE_URL = '/'
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.ico']

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (!url.protocol.startsWith('http')) return
  if (isDevelopmentRequest(url, request)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isImmutableNuxtAsset(url)) {
    event.respondWith(cacheFirstAsset(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

function isDevelopmentRequest(url, request) {
  const path = url.pathname
  return (
    path.startsWith('/@vite/') ||
    path.startsWith('/__vite') ||
    path.includes('/_nuxt/@vite/') ||
    path.includes('vite-hmr') ||
    path.includes('__nuxt_error') ||
    path.includes('/@id/') ||
    path.includes('/@fs/') ||
    path.endsWith('.map') ||
    request.headers.get('accept')?.includes('text/event-stream')
  )
}

function isImmutableNuxtAsset(url) {
  if (!url.pathname.startsWith('/_nuxt/')) return false
  // Production Nuxt assets use generated names. Avoid treating obvious
  // virtual/dev paths as immutable even if this worker is accidentally present.
  return !url.pathname.includes('@') && !url.pathname.includes('node_modules')
}

function responseMatchesDestination(request, response) {
  const contentType = response.headers.get('content-type') || ''
  if (request.destination === 'style') return contentType.includes('text/css')
  if (request.destination === 'script') {
    return contentType.includes('javascript') || contentType.includes('ecmascript')
  }
  return true
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached && responseMatchesDestination(request, cached)) return cached
  if (cached) await cache.delete(request)

  try {
    const response = await fetch(request)
    if (response.ok && responseMatchesDestination(request, response)) {
      await cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline — asset unavailable', { status: 503 })
  }
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || new Response('Offline', { status: 503 })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)

  const network = fetch(request)
    .then(async response => {
      if (response.ok && responseMatchesDestination(request, response)) {
        await cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  if (cached && responseMatchesDestination(request, cached)) {
    void network
    return cached
  }

  return (await network) || new Response('Offline', { status: 503 })
}

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
