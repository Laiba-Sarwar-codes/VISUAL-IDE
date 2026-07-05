// app/stores/monitoring.ts
// V1: Real monitoring metrics — reads from renderer perf monitor, camera store, peers

import { defineStore } from 'pinia'
import { monitoringService } from '~~/src/monitoring/MonitoringService'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'
import { useEditorStore } from '~/stores/editor'
import { useOfflineStore } from '~/stores/offline'
import { useVersionControlStore } from '~/stores/versionControl'
import { useProjectStore } from '~/stores/project'
import { useAIWorkflowStore } from '~/stores/aiWorkflow'
import { webRTCManager } from '~~/src/collaboration/webrtc/WebRTCManager'
import { workerService } from '~~/src/services/WorkerService'
import type { MonitoringSnapshot } from '~~/src/monitoring/types'

interface MonitoringState {
  isOpen: boolean
  snapshot: MonitoringSnapshot | null
  pollIntervalMs: number
}

// Shared renderer reference — set by CanvasWorkspace so monitoring
// reads the SAME PerformanceMonitor instance the renderer uses
let _rendererPerfRef: { snapshot: { fps: number; renderMs: number; totalObjects: number; visibleObjects: number; culledObjects: number } } | null = null

export function setRendererPerfRef(perf: typeof _rendererPerfRef): void {
  _rendererPerfRef = perf
}

export const useMonitoringStore = defineStore('monitoring', {
  state: (): MonitoringState => ({
    isOpen: false,
    snapshot: null,
    pollIntervalMs: 500,  // V1: 500ms aggregate interval per spec
  }),

  actions: {
    open():   void { this.isOpen = true },
    close():  void { this.isOpen = false },
    toggle(): void { this.isOpen = !this.isOpen },

    /**
     * V1: Reads real metrics from:
     * - renderer.perf.snapshot (FPS, frame time, culled/rendered counts)
     * - editor store (camera x, y, zoom — unified source of truth)
     * - webRTCManager (peer count)
     * - offline store (queue length)
     * No hard-coded zeros for metrics we can calculate.
     */
    poll(): void {
      const scene   = useSceneStore()
      const sel     = useSelectionStore()
      const editor  = useEditorStore()
      const offline = useOfflineStore()
      const vc      = useVersionControlStore()
      const project = useProjectStore()
      const ai      = useAIWorkflowStore()

      // V1: Use renderer's real perf data when available
      const rendererPerf = _rendererPerfRef?.snapshot
      const visible = scene.objects.filter(o => o.visible).length
      const locked  = scene.objects.filter(o => o.locked).length

      this.snapshot = monitoringService.buildSnapshot({
        scene: {
          totalObjects:    scene.objects.length,
          visibleObjects:  visible,
          hiddenObjects:   scene.objects.length - visible,
          lockedObjects:   locked,
          selectedObjects: sel.selectedId ? 1 : 0,
        },
        render: rendererPerf ? {
          // V1: real values from renderer performance monitor
          renderedObjects: rendererPerf.visibleObjects,
          culledObjects:   rendererPerf.totalObjects - rendererPerf.visibleObjects,
          frameTimeMs:     rendererPerf.renderMs,
          fps:             rendererPerf.fps,
        } : {
          renderedObjects: visible,
          culledObjects:   0,
          frameTimeMs:     0,
          fps:             0,
        },
        network: {
          status:    offline.networkStatus,
          queuedOps: offline.queueLength,
        },
        collab: {
          inRoom:     webRTCManager.isInRoom,
          roomId:     webRTCManager.roomId,
          peersCount: webRTCManager.getConnectedPeers().length,
        },
        workers: {
          assetWorker: workerService.isAvailable ? 'available' : 'unavailable',
        },
        camera: {
          // V1: real camera x, y, zoom from unified editor store
          x:    editor.cameraX,
          y:    editor.cameraY,
          zoom: editor.zoom,
        },
        editor: {
          activeTool:        editor.activeTool,
          activeProjectName: project.activeProjectName,
          currentBranch:     vc.currentBranch?.name ?? 'main',
          commitCount:       vc.commits.length,
        },
        ai: ai.metrics,
      })
    },

    start(): void {
      monitoringService.start()
    },

    stop(): void {
      monitoringService.stop()
    },
  },
})
