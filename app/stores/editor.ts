// app/stores/editor.ts
// V1.1 — adds snapEnabled toggle to unified camera state store

import { defineStore } from 'pinia'
import type { ToolId, EditorUIState } from '~~/src/state-manager/types'

const ZOOM_MIN = 0.1
const ZOOM_MAX = 8

function clampZoom(z: number): number {
  if (!isFinite(z) || isNaN(z)) return 1
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

function safeCoord(v: number, fallback = 0): number {
  return isFinite(v) && !isNaN(v) ? v : fallback
}

export const useEditorStore = defineStore('editor', {
  state: (): EditorUIState & { cameraX: number; cameraY: number; snapEnabled: boolean } => ({
    activeTool: 'select',
    leftPanelOpen: true,
    rightPanelOpen: true,
    selectedNodeId: null,
    zoom: 1,
    cameraX: 0,
    cameraY: 0,
    snapEnabled: true,
    statusMessage: 'Ready',
  }),

  getters: {
    cameraState(): { x: number; y: number; zoom: number } {
      return { x: this.cameraX, y: this.cameraY, zoom: this.zoom }
    },
  },

  actions: {
    setTool(tool: ToolId) {
      this.activeTool = tool
      this.statusMessage = `Tool: ${tool}`
    },
    toggleLeftPanel() {
      this.leftPanelOpen = !this.leftPanelOpen
    },
    toggleRightPanel() {
      this.rightPanelOpen = !this.rightPanelOpen
    },
    selectNode(id: string | null) {
      this.selectedNodeId = id
    },
    setZoom(zoom: number) {
      this.zoom = clampZoom(zoom)
    },
    setCameraState(x: number, y: number, zoom: number) {
      this.cameraX = safeCoord(x)
      this.cameraY = safeCoord(y)
      this.zoom = clampZoom(zoom)
    },
    restoreCamera(x?: number, y?: number, zoom?: number) {
      this.cameraX = safeCoord(x ?? 0)
      this.cameraY = safeCoord(y ?? 0)
      this.zoom = clampZoom(zoom ?? 1)
    },
    /**
     * Why: snap is toggled from the toolbar so the user can hold Shift
     * equivalent or click the magnet icon to temporarily disable snap.
     */
    toggleSnap() {
      this.snapEnabled = !this.snapEnabled
    },
    setStatusMessage(message: string) {
      this.statusMessage = message
    },
  },
})