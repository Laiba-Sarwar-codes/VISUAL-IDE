<!-- app/components/collaboration/RemoteCursors.vue -->
<!-- Module 15 — renders remote peer cursors over the canvas -->
<template>
  <div class="cursors-layer" aria-hidden="true">
    <div
      v-for="peer in visiblePeers"
      :key="peer.peerId"
      class="remote-cursor"
      :style="cursorStyle(peer)"
    >
      <svg class="cursor-icon" width="16" height="16" viewBox="0 0 16 16">
        <path
          d="M2 2 L2 12 L5.5 9 L8 14 L10 13 L7.5 8 L12 8 Z"
          :fill="peer.color"
          stroke="#000"
          stroke-width="0.8"
        />
      </svg>
      <span class="cursor-label" :style="{ background: peer.color }">
        {{ peer.name }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { webRTCManager } from '~~/src/collaboration/webrtc/WebRTCManager'
import type { ConnectedPeer } from '~~/src/collaboration/webrtc/types'

// Camera transform is needed to convert world coords → screen coords.
// Props let CanvasWorkspace pass its current camera state down.
const props = defineProps<{
  cameraX: number
  cameraY: number
  cameraZoom: number
  canvasWidth: number
  canvasHeight: number
}>()

const peers = ref<ConnectedPeer[]>([])

// Only show peers with a recent active timestamp
const visiblePeers = computed(() =>
  peers.value.filter(p =>
    p.connectionState === 'connected' &&
    Date.now() - p.lastActive < 10_000
  )
)

/**
 * Why: peer cursor positions are in world space. We must convert them
 * to screen space using the same Camera math used by the renderer.
 * This mirrors Camera.worldToScreen() without importing the class.
 */
function cursorStyle(peer: ConnectedPeer): Record<string, string> {
  const cx = props.canvasWidth / 2
  const cy = props.canvasHeight / 2
  const screenX = (peer.cursorX - props.cameraX) * props.cameraZoom + cx
  const screenY = (peer.cursorY - props.cameraY) * props.cameraZoom + cy
  return {
    transform: `translate(${screenX}px, ${screenY}px)`,
    pointerEvents: 'none',
  }
}

function refresh(): void {
  peers.value = webRTCManager.getConnectedPeers()
}

let interval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  refresh()
  webRTCManager.onPeerJoined(refresh)
  webRTCManager.onPeerLeft(refresh)
  // Poll for cursor position updates every 100ms
  interval = setInterval(refresh, 100)
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<style scoped>
.cursors-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.remote-cursor {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: flex-start;
  gap: 4px;
  will-change: transform;
}

.cursor-icon {
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.cursor-label {
  font-size: 11px;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  margin-top: 14px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  box-shadow: 0 1px 3px rgba(0,0,0,0.4);
}
</style>