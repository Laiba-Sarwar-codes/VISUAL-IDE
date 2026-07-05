<!-- app/components/canvas/CanvasWorkspace.vue -->
<template>
  <div ref="containerRef" class="canvas-workspace">
    <canvas
      ref="canvasRef"
      class="canvas-surface"
      :class="cursorClass"
      aria-label="Infinite visual editor canvas"
    />

    <div class="canvas-badge" aria-hidden="true">
      <span class="canvas-badge-dot" />
      Infinite canvas
    </div>

    <div v-if="scene.objects.length === 0" class="canvas-empty" aria-hidden="true">
      <div class="canvas-empty-icon">✦</div>
      <strong>Start creating</strong>
      <span>Choose Rectangle, Ellipse or Text, then click anywhere on the canvas.</span>
    </div>

    <RemoteCursors
      v-if="webRTCManager.isInRoom"
      :camera-x="editor.cameraX"
      :camera-y="editor.cameraY"
      :camera-zoom="editor.zoom"
      :canvas-width="cssWidth"
      :canvas-height="cssHeight"
    />

    <div v-if="isDev" class="stress-bar">
      <button type="button" class="stress-btn" @click="runStressTest">
        Stress test
      </button>
      <span class="perf-label">{{ perfLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Renderer } from '~~/src/engine/rendering/Renderer'
import { Camera } from '~~/src/engine/rendering/Camera'
import { computeSnap } from '~~/src/engine/rendering/SnapGuides'
import type { GuideLine } from '~~/src/engine/rendering/SnapGuides'
import {
  getRelativeScreenPoint,
  getViewportCenter,
  normalizeWheelToZoomFactor,
} from '~~/src/engine/rendering/coordinates'
import { hitTestObjects } from '~~/src/engine/scene-graph/hitTest'
import { SelectionManager } from '~~/src/engine/scene-graph/SelectionManager'
import { collectDescendantsAndSelf } from '~~/src/layers/LayerGroupingService'
import { useEditorStore } from '~/stores/editor'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'
import { useAssetStore } from '~/stores/asset'
import { useCollaboration } from '~/composables/useCollaboration'
import { webRTCManager } from '~~/src/collaboration/webrtc/WebRTCManager'
import RemoteCursors from '~/components/collaboration/RemoteCursors.vue'

const editor = useEditorStore()
const scene = useSceneStore()
const selection = useSelectionStore()
const assetStore = useAssetStore()
const collab = useCollaboration()
const isDev = import.meta.env.DEV

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const perfLabel = ref('FPS — · 0 objects · 0 visible')
const cssWidth = ref(0)
const cssHeight = ref(0)

const camera = new Camera({ x: 0, y: 0, zoom: 1 })
const selectionManager = new SelectionManager()
const renderer = new Renderer()

let resizeObserver: ResizeObserver | null = null
let resizeRaf: number | null = null
let isPanningCamera = false
let lastPointer = { x: 0, y: 0 }
let lastMoveTime = 0
let lastWheelTime = 0
let perfInterval: ReturnType<typeof setInterval> | null = null

// Layer Management — double-click "enters" a group so a subsequent click
// can select a specific descendant instead of the whole group (see
// hitTest.ts). Session-local only, never persisted/synced.
const enteredGroupId = ref<string | null>(null)

interface GroupDragState {
  groupId: string
  startWorldX: number
  startWorldY: number
  childStartPositions: Map<string, { x: number; y: number }>
}
let groupDrag: GroupDragState | null = null

const MOVE_THROTTLE_MS = 16
const WHEEL_THROTTLE_MS = 16

const cursorClass = computed(() => {
  if (editor.activeTool === 'pan') return 'cursor-pan'
  if (selectionManager.drag.isDragging) return 'cursor-grabbing'
  if (editor.activeTool === 'select') return 'cursor-select'
  return 'cursor-crosshair'
})

watch(
  () => scene.objects,
  objects => renderer.update({ objects: [...objects] }),
  { deep: true }
)

watch(
  () => [selection.selectedId, selection.selectedIds] as const,
  () => {
    renderer.update({
      selectedObject: selection.selectedObject,
      selectedObjects: selection.selectedObjects,
    })
    collab.updateSelection(selection.selectedId)
  },
  { deep: true }
)

watch(
  () => assetStore.assets,
  assets => renderer.setAssets(assets),
  { deep: true }
)

// Store-driven camera changes (project restore, command palette zoom)
// mirrored into the real Camera instance. Equality check avoids feedback loops.
watch(
  () => [editor.cameraX, editor.cameraY, editor.zoom] as const,
  ([x, y, zoom]) => {
    if (camera.x === x && camera.y === y && camera.zoom === zoom) return
    camera.x = x
    camera.y = y
    camera.zoom = zoom
    renderer.update({ camera })
  }
)

function syncCameraToStore(): void {
  editor.setCameraState(camera.x, camera.y, camera.zoom)
}

function handlePointerDown(e: PointerEvent): void {
  const canvas = canvasRef.value
  if (!canvas) return

  canvas.focus({ preventScroll: true })
  const rect = canvas.getBoundingClientRect()
  const screenPoint = getRelativeScreenPoint(e.clientX, e.clientY, rect)
  const center = getViewportCenter(rect)
  const worldPoint = camera.screenToWorld(screenPoint, center)
  lastPointer = { x: e.clientX, y: e.clientY }

  if (editor.activeTool !== 'select' && editor.activeTool !== 'pan') {
    scene.addObject({ type: editor.activeTool, x: worldPoint.x, y: worldPoint.y })
    editor.setStatusMessage(`Created ${editor.activeTool}`)
    return
  }

  if (editor.activeTool === 'pan') {
    isPanningCamera = true
    return
  }

  const hit = hitTestObjects(worldPoint.x, worldPoint.y, scene.objects, enteredGroupId.value)
  if (hit) {
    if (e.shiftKey) {
      selection.toggleSelect(hit.id)
    } else if (selection.isSelected(hit.id) && selection.selectedIds.length > 1) {
      // Clicking a member already inside a multi-selection just makes it
      // primary — it must not clear the rest of the selection.
      selection.makePrimary(hit.id)
    } else {
      selection.select(hit.id)
    }

    if (hit.locked) {
      editor.setStatusMessage(`Locked: ${hit.name} (unlock in Layers panel)`)
      return
    }

    if (hit.type === 'group') {
      const descendantIds = [...collectDescendantsAndSelf(scene.objects, hit.id)].filter(id => id !== hit.id)
      const byId = new Map(scene.objects.map(o => [o.id, o]))
      groupDrag = {
        groupId: hit.id,
        startWorldX: worldPoint.x,
        startWorldY: worldPoint.y,
        childStartPositions: new Map(
          descendantIds
            .map(id => byId.get(id))
            .filter((o): o is NonNullable<typeof o> => o !== undefined)
            .map(o => [o.id, { x: o.x, y: o.y }])
        ),
      }
      editor.setStatusMessage(`Selected: ${hit.name}`)
      return
    }

    selectionManager.select(hit)
    const dragStarted = selectionManager.startDrag(worldPoint.x, worldPoint.y, hit)
    if (dragStarted) editor.setStatusMessage(`Selected: ${hit.name}`)
  } else {
    selectionManager.select(null)
    groupDrag = null
    selection.clear()
    isPanningCamera = true
    editor.setStatusMessage('Panning canvas')
  }
}

function handleDoubleClick(e: MouseEvent): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const screenPoint = getRelativeScreenPoint(e.clientX, e.clientY, rect)
  const center = getViewportCenter(rect)
  const worldPoint = camera.screenToWorld(screenPoint, center)

  const hit = hitTestObjects(worldPoint.x, worldPoint.y, scene.objects, enteredGroupId.value)
  if (hit && hit.type === 'group') {
    enteredGroupId.value = hit.id
    selection.select(hit.id)
    editor.setStatusMessage(`Entered group: ${hit.name}`)
  } else if (hit) {
    selection.select(hit.id)
  }
}

function handlePointerMove(e: PointerEvent): void {
  const now = Date.now()
  if (now - lastMoveTime < MOVE_THROTTLE_MS) return
  lastMoveTime = now

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const screenPoint = getRelativeScreenPoint(e.clientX, e.clientY, rect)
  const center = getViewportCenter(rect)
  const worldPoint = camera.screenToWorld(screenPoint, center)

  collab.updateCursor(worldPoint.x, worldPoint.y)

  if (groupDrag) {
    const dx = worldPoint.x - groupDrag.startWorldX
    const dy = worldPoint.y - groupDrag.startWorldY
    for (const [id, start] of groupDrag.childStartPositions) {
      scene.updateObject(id, { x: start.x + dx, y: start.y + dy })
    }
    editor.setStatusMessage(`Moving group · dx ${Math.round(dx)} · dy ${Math.round(dy)}`)
    return
  }

  if (selectionManager.drag.isDragging && selectionManager.selectedId) {
    const rawPos = selectionManager.computeDragPosition(worldPoint.x, worldPoint.y)
    const draggedObj = scene.objects.find(o => o.id === selectionManager.selectedId)

    let finalPos = rawPos
    let guideLines: GuideLine[] = []

    // Compute snap against grid and other objects' edges/centers
    if (draggedObj) {
      const snap = computeSnap(
        { ...draggedObj, x: rawPos.x, y: rawPos.y },
        scene.objects,
        camera.zoom
      )
      finalPos = { x: snap.x, y: snap.y }
      guideLines = snap.guideLines
    }

    scene.updateObject(selectionManager.selectedId, finalPos)
    renderer.update({ guideLines })
    editor.setStatusMessage(`x ${Math.round(finalPos.x)} · y ${Math.round(finalPos.y)}`)
    return
  }

  if (isPanningCamera) {
    const dx = e.clientX - lastPointer.x
    const dy = e.clientY - lastPointer.y
    camera.panByScreenDelta(dx, dy)
    lastPointer = { x: e.clientX, y: e.clientY }
    syncCameraToStore()
    renderer.update({ camera })
  }
}

function handlePointerUp(): void {
  if (groupDrag) {
    scene.recomputeGroupBounds(groupDrag.groupId)
    groupDrag = null
  }
  selectionManager.endDrag()
  isPanningCamera = false
  // Clear snap guide lines when drag ends
  renderer.update({ guideLines: [] })
  if (selection.selectedObject) {
    editor.setStatusMessage(`Selected: ${selection.selectedObject.name}`)
  } else {
    editor.setStatusMessage('Ready')
  }
}

function handleWheel(e: WheelEvent): void {
  e.preventDefault()
  const now = Date.now()
  if (now - lastWheelTime < WHEEL_THROTTLE_MS) return
  lastWheelTime = now

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const screenPoint = getRelativeScreenPoint(e.clientX, e.clientY, rect)
  const center = getViewportCenter(rect)
  const factor = normalizeWheelToZoomFactor(e.deltaY)
  camera.zoomAtScreenPoint(screenPoint, center, factor)
  syncCameraToStore()
  renderer.update({ camera })
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && enteredGroupId.value) {
    enteredGroupId.value = null
    editor.setStatusMessage('Exited group')
    return
  }

  if ((e.key === 'Delete' || e.key === 'Backspace') && selection.selectedIds.length > 0) {
    const lockedObj = selection.selectedObjects.find(o => o.locked)
    if (lockedObj) {
      editor.setStatusMessage(`Cannot delete locked object: ${lockedObj.name}`)
      return
    }
    selection.deleteSelected()
    selectionManager.select(null)
    editor.setStatusMessage('Deleted')
  }
}

function runStressTest(): void {
  for (let i = 0; i < 500; i++) {
    scene.addObject({
      type: 'rectangle',
      x: (Math.random() - 0.5) * 6000,
      y: (Math.random() - 0.5) * 6000,
      width: 80 + Math.random() * 80,
      height: 40 + Math.random() * 60,
    })
  }
  editor.setStatusMessage('Stress test: 500 objects added')
}

function scheduleResize(attempt = 0): void {
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null
    const canvas = canvasRef.value
    const container = containerRef.value
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    if ((rect.width < 2 || rect.height < 2) && attempt < 8) {
      scheduleResize(attempt + 1)
      return
    }

    if (rect.width < 2 || rect.height < 2) return
    cssWidth.value = Math.round(rect.width)
    cssHeight.value = Math.round(rect.height)
    renderer.resize(canvas, container)
    renderer.markDirty()
  })
}

onMounted(async () => {
  await nextTick()
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  renderer.mount(canvas)

  camera.x = editor.cameraX
  camera.y = editor.cameraY
  camera.zoom = editor.zoom

  renderer.update({
    camera,
    objects: [...scene.objects],
    selectedObject: selection.selectedObject,
    selectedObjects: selection.selectedObjects,
    guideLines: [],
  })

  if (assetStore.assets.length > 0) renderer.setAssets(assetStore.assets)

  canvas.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('wheel', handleWheel, { passive: false })
  canvas.addEventListener('dblclick', handleDoubleClick)
  window.addEventListener('keydown', handleKeyDown)

  resizeObserver = new ResizeObserver(() => scheduleResize())
  resizeObserver.observe(container)
  scheduleResize()

  perfInterval = setInterval(() => {
    const s = renderer.perf.snapshot
    perfLabel.value = `${s.fps || '—'} FPS · ${s.totalObjects} objects · ${s.visibleObjects} visible · ${s.renderMs}ms`
  }, 500)
})

onUnmounted(() => {
  const canvas = canvasRef.value
  renderer.unmount()
  canvas?.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  canvas?.removeEventListener('wheel', handleWheel)
  canvas?.removeEventListener('dblclick', handleDoubleClick)
  window.removeEventListener('keydown', handleKeyDown)
  resizeObserver?.disconnect()
  if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
  if (perfInterval) clearInterval(perfInterval)
})
</script>

<style scoped>
.canvas-workspace {
  position: relative;
  isolation: isolate;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--canvas-bg);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.012);
}

.canvas-surface {
  position: absolute;
  inset: 0;
  z-index: var(--z-canvas);
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  outline: none;
  touch-action: none;
}

.cursor-select { cursor: default; }
.cursor-pan { cursor: grab; }
.cursor-grabbing { cursor: grabbing; }
.cursor-crosshair { cursor: crosshair; }

.canvas-badge {
  position: absolute;
  z-index: var(--z-canvas-overlay);
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(53, 65, 85, 0.78);
  border-radius: 999px;
  background: rgba(13, 18, 27, 0.76);
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  backdrop-filter: blur(8px);
  pointer-events: none;
}

.canvas-badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(124,131,255,0.12);
}

.canvas-empty {
  position: absolute;
  z-index: var(--z-canvas-overlay);
  left: 50%;
  top: 50%;
  width: min(310px, calc(100% - 48px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transform: translate(-50%, -50%);
  padding: 24px 26px;
  border: 1px solid rgba(57, 69, 91, 0.48);
  border-radius: 16px;
  background: rgba(12, 16, 24, 0.72);
  text-align: center;
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.canvas-empty-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  margin-bottom: 2px;
  border: 1px solid rgba(129,140,248,0.28);
  border-radius: 14px;
  background: var(--accent-soft);
  color: #b9bdff;
  font-size: 18px;
}

.canvas-empty strong { color: var(--text-primary); font-size: 13px; }
.canvas-empty span { max-width: 250px; color: var(--text-muted); font-size: 10px; line-height: 1.6; }

.stress-bar {
  position: absolute;
  z-index: var(--z-floating);
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 24px);
  min-height: 31px;
  padding: 4px 6px 4px 9px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: rgba(13,18,27,0.86);
  color: var(--text-muted);
  box-shadow: 0 10px 30px rgba(0,0,0,0.24);
  backdrop-filter: blur(10px);
}

.stress-btn {
  height: 23px;
  padding: 0 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 9px;
}

.stress-btn:hover { border-color: rgba(129,140,248,0.34); color: var(--text-primary); }
.perf-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--success); font: 500 9px/1 ui-monospace, monospace; }
</style>