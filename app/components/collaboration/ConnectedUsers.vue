<!-- app/components/collaboration/ConnectedUsers.vue -->
<!-- Module 15 — displays connected peers -->
<!--
  Fix: onPeerJoined / onPeerLeft callbacks are now deregistered in
  onUnmounted() via offPeerJoined / offPeerLeft. Without this, every
  time the CollaborationPanel re-mounts a new set of stale closures
  accumulates, calling refresh() on an unmounted component.
-->
<template>
  <div class="connected-users">
    <div class="section-label">Connected ({{ peers.length }})</div>

    <div v-if="peers.length === 0" class="empty">
      No other users yet. Share the room ID to invite someone.
    </div>

    <div
      v-for="peer in peers"
      :key="peer.peerId"
      class="peer-row"
    >
      <span
        class="peer-dot"
        :style="{ background: peer.color }"
      />
      <span class="peer-name">{{ peer.name }}</span>
      <span class="peer-status" :class="peer.connectionState">
        {{ peer.connectionState === 'connected' ? '● online' : '○ connecting' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { webRTCManager } from '~~/src/collaboration/webrtc/WebRTCManager'
import type { ConnectedPeer } from '~~/src/collaboration/webrtc/types'

const peers = ref<ConnectedPeer[]>([])

function refresh() {
  peers.value = webRTCManager.getConnectedPeers()
}

// Keep named references so we can deregister them exactly
const onJoined = (_peer: ConnectedPeer) => refresh()
const onLeft = (_peerId: string) => refresh()

onMounted(() => {
  refresh()
  webRTCManager.onPeerJoined(onJoined)
  webRTCManager.onPeerLeft(onLeft)
})

onUnmounted(() => {
  // Fix: deregister to prevent stale-closure accumulation
  webRTCManager.offPeerJoined(onJoined)
  webRTCManager.offPeerLeft(onLeft)
  peers.value = []
})
</script>

<style scoped>
.connected-users { display: flex; flex-direction: column; gap: 6px; }
.section-label {
  font-size: 10px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.5px; margin-bottom: 2px;
}
.empty { font-size: 12px; color: var(--text-muted); font-style: italic; }
.peer-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; background: var(--surface-0); border-radius: 6px;
}
.peer-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.peer-name { flex: 1; font-size: 13px; color: var(--text-secondary); }
.peer-status { font-size: 10px; font-family: monospace; }
.peer-status.connected { color: var(--success); }
.peer-status.connecting { color: var(--warning); }
.peer-status.disconnected { color: var(--danger); }
</style>