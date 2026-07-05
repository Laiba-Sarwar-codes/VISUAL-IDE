<!-- app/components/canvas/CanvasMinimap.vue -->
<!-- Minimap — bottom-right overlay showing scene objects + viewport indicator -->
<template>
  <div class="minimap" aria-hidden="true">
    <canvas ref="minimapCanvas" class="minimap-canvas" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useSceneStore } from '~/stores/scene'
import { useEditorStore } from '~/stores/editor'

const MINIMAP_W = 160
const MINIMAP_H = 100
const PADDING = 12       // world-space padding around scene bounds
const BG = '#0b0f17'
const BORDER = '#1e2a3a'
const VIEWPORT_FILL = 'rgba(124,131,255,0.08)'
const VIEWPORT_STROKE = 'rgba(124,131,255,0.55)'
const OBJECT_COLOR = '#4c5a7a'
const SELECTED_COLOR = '#7c83ff'

const scene = useSceneStore()
const editor = useEditorStore()

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null
const minimapCanvas = { value: null as HTMLCanvasElement | null }

// Use a template ref the manual way so we can access it in onMounted
import { ref } from 'vue'
const canvasRef = ref<HTMLCanvasElement | null>(null)

/**
 * Why: computes the world-space bounding box that contains ALL scene
 * objects plus padding. This is the region the minimap represents.
 * Falls back to a default world view when the scene is empty so the
 * minimap still shows a stable viewport indicator.
 */
function getSceneBounds() {
  const objs = scene.objects.filter(o => o.visible)
  if (objs.length === 0) {
    return { left: -400, top: -250, width: 800, height: 500 }
  }

  let left   = Infinity
  let top    = Infinity
  let right  = -Infinity
  let bottom = -Infinity

  for (const obj of objs) {
    left   = Math.min(left,   obj.x)
    top    = Math.min(top,    obj.y)
    right  = Math.max(right,  obj.x + obj.width)
    bottom = Math.max(bottom, obj.y + obj.height)
  }

  left   -= PADDING
  top    -= PADDING
  right  += PADDING
  bottom += PADDING

  return { left, top, width: right - left, height: bottom - top }
}

function draw(): void {
  if (!ctx || !canvasRef.value) return

  const dpr = window.devicePixelRatio || 1
  const w = MINIMAP_W
  const h = MINIMAP_H

  // Set canvas buffer size once if needed
  if (canvasRef.value.width !== w * dpr) {
    canvasRef.value.width  = w * dpr
    canvasRef.value.height = h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // ── Background ──────────────────────────────────────────────────────
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, w, h)

  const bounds = getSceneBounds()
  const scaleX = w / bounds.width
  const scaleY = h / bounds.height
  const scale  = Math.min(scaleX, scaleY)

  // Centre the scene within the minimap
  const offsetX = (w - bounds.width  * scale) / 2
  const offsetY = (h - bounds.height * scale) / 2

  const toMiniX = (wx: number) => (wx - bounds.left) * scale + offsetX
  const toMiniY = (wy: number) => (wy - bounds.top)  * scale + offsetY

  // ── Scene objects ────────────────────────────────────────────────────
  const sorted = [...scene.objects]
    .filter(o => o.visible)
    .sort((a, b) => a.zIndex - b.zIndex)

  for (const obj of sorted) {
    const mx = toMiniX(obj.x)
    const my = toMiniY(obj.y)
    const mw = Math.max(2, obj.width  * scale)
    const mh = Math.max(2, obj.height * scale)

    ctx.fillStyle = obj.fill && obj.fill !== 'transparent' ? obj.fill : OBJECT_COLOR
    ctx.globalAlpha = obj.opacity * 0.85
    ctx.fillRect(mx, my, mw, mh)
    ctx.globalAlpha = 1
  }

  // ── Viewport indicator ───────────────────────────────────────────────
  // The viewport is the visible canvas area in world space.
  // We need the canvas CSS pixel size to compute it.
  // We use a standard 16:10 fallback if actual size not available.
  const canvasW = canvasRef.value.parentElement?.clientWidth  ?? 1200
  const canvasH = canvasRef.value.parentElement?.clientHeight ?? 700

  const cx = editor.cameraX
  const cy = editor.cameraY
  const zoom = editor.zoom

  // Top-left and bottom-right of viewport in world space
  const vpLeft   = cx - canvasW / 2 / zoom
  const vpTop    = cy - canvasH / 2 / zoom
  const vpRight  = cx + canvasW / 2 / zoom
  const vpBottom = cy + canvasH / 2 / zoom

  const vx = toMiniX(vpLeft)
  const vy = toMiniY(vpTop)
  const vw = (vpRight  - vpLeft) * scale
  const vh = (vpBottom - vpTop)  * scale

  // Clamp to minimap bounds for visual cleanliness
  const clampedVx = Math.max(-2, vx)
  const clampedVy = Math.max(-2, vy)
  const clampedVw = Math.min(vw, w - clampedVx + 2)
  const clampedVh = Math.min(vh, h - clampedVy + 2)

  ctx.fillStyle   = VIEWPORT_FILL
  ctx.fillRect(clampedVx, clampedVy, clampedVw, clampedVh)

  ctx.strokeStyle = VIEWPORT_STROKE
  ctx.lineWidth   = 1.5
  ctx.strokeRect(clampedVx, clampedVy, clampedVw, clampedVh)
}

// Redraw whenever scene objects or camera changes
watch(() => scene.objects, draw, { deep: true })
watch(() => [editor.cameraX, editor.cameraY, editor.zoom], draw)

onMounted(() => {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  draw()
})

onUnmounted(() => {
  ctx = null
})

// Expose canvasRef to the template
defineExpose({ canvasRef })
</script>

<!-- Override: use canvasRef directly in template via ref attribute -->
<template>
  <div class="minimap" aria-hidden="true">
    <canvas ref="canvasRef" class="minimap-canvas" :width="160" :height="100" />
  </div>
</template>

<style scoped>
.minimap {
  position: absolute;
  z-index: var(--z-floating, 50);
  right: 12px;
  bottom: 52px;  /* sits above the stress-bar when in dev mode */
  width: 160px;
  height: 100px;
  border: 1px solid rgba(53, 65, 85, 0.7);
  border-radius: 8px;
  background: #0b0f17;
  overflow: hidden;
  pointer-events: none;
  box-shadow: 0 4px 20px rgba(0,0,0,0.45);
  opacity: 0.88;
}

.minimap-canvas {
  display: block;
  width: 160px;
  height: 100px;
}
</style>