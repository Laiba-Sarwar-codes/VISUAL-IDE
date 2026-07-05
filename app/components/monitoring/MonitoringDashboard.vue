<!-- app/components/monitoring/MonitoringDashboard.vue -->
<!-- Module 21 — floating monitoring dashboard -->
<template>
  <div v-if="mon.isOpen" class="dashboard">
    <PageHeader
      :icon="Activity"
      title="Monitoring"
      description="Live performance, scene, editor, network, collaboration, and worker metrics."
      @back="mon.close()"
    />

    <div class="dash-body">
      <template v-if="snap">
        <!-- FPS + Memory -->
        <div class="section-title">Performance</div>
        <div class="stat-grid">
          <StatCard
            label="FPS"
            :value="snap.fps.fps"
            :sub="`${snap.fps.frameTime}ms/frame`"
            :value-color="fpsColor(snap.fps.fps)"
          />
          <StatCard
            v-if="snap.memory.supported"
            label="Heap"
            :value="`${snap.memory.usedMB}MB`"
            :sub="`${snap.memory.percent}% of ${snap.memory.limitMB}MB`"
            :value-color="memColor(snap.memory.percent)"
          />
          <StatCard v-else label="Heap" value="N/A" sub="unsupported" value-color="var(--text-muted)" />
        </div>

        <!-- Scene -->
        <div class="section-title">Scene</div>
        <div class="stat-grid">
          <StatCard label="Objects"  :value="snap.scene.totalObjects" />
          <StatCard label="Visible"  :value="snap.scene.visibleObjects" value-color="var(--success)" />
          <StatCard label="Hidden"   :value="snap.scene.hiddenObjects"  value-color="var(--text-muted)" />
          <StatCard label="Locked"   :value="snap.scene.lockedObjects"  value-color="var(--warning)" />
          <StatCard label="Selected" :value="snap.scene.selectedObjects" value-color="var(--accent)" />
        </div>

        <!-- Editor -->
        <div class="section-title">Editor</div>
        <div class="stat-grid">
          <StatCard label="Tool"   :value="snap.editor.activeTool" />
          <StatCard label="Zoom" :value="`${Math.round(snap.camera.zoom * 100)}%`" />
          <StatCard label="Cam X" :value="Math.round(snap.camera.x)" />
          <StatCard label="Cam Y" :value="Math.round(snap.camera.y)" />
          <StatCard label="Branch" :value="snap.editor.currentBranch" />
          <StatCard label="Commits" :value="snap.editor.commitCount" />
        </div>

        <!-- Network + Collab -->
        <div class="section-title">Network & Collaboration</div>
        <div class="stat-grid">
          <StatCard
            label="Network"
            :value="snap.network.status"
            :value-color="netColor(snap.network.status)"
          />
          <StatCard label="Queued" :value="snap.network.queuedOps" />
          <StatCard
            label="Collab"
            :value="snap.collab.inRoom ? 'Connected' : 'Offline'"
            :value-color="snap.collab.inRoom ? 'var(--success)' : 'var(--text-muted)'"
          />
          <StatCard label="Peers" :value="snap.collab.peersCount" />
        </div>

        <!-- Workers -->
        <div class="section-title">Workers</div>
        <div class="stat-grid">
          <StatCard
            label="Asset Worker"
            :value="snap.workers.assetWorker"
            :value-color="snap.workers.assetWorker === 'available' ? 'var(--success)' : 'var(--danger)'"
          />
        </div>
      </template>

      <div v-else class="loading">Initializing…</div>

      <div class="dash-footer">
        Updated {{ lastUpdated }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Activity } from 'lucide-vue-next'
import { useMonitoringStore } from '~/stores/monitoring'
import StatCard from './StatCard.vue'
import PageHeader from '~/components/app-shell/PageHeader.vue'

const mon = useMonitoringStore()
const snap = computed(() => mon.snapshot)
const lastUpdated = ref('—')

let pollTimer: ReturnType<typeof setInterval> | null = null

function fpsColor(fps: number): string {
  if (fps >= 55) return 'var(--success)'
  if (fps >= 30) return 'var(--warning)'
  return 'var(--danger)'
}

function memColor(pct: number): string {
  if (pct < 60) return 'var(--success)'
  if (pct < 80) return 'var(--warning)'
  return 'var(--danger)'
}

function netColor(status: string): string {
  if (status === 'online') return 'var(--success)'
  if (status === 'reconnecting') return 'var(--warning)'
  return 'var(--danger)'
}

onMounted(() => {
  mon.start()
  mon.poll()

  pollTimer = setInterval(() => {
    mon.poll()
    const d = new Date()
    lastUpdated.value = `${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  }, 500)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  mon.stop()
})
</script>

<style scoped>
.dashboard {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.dash-body {
  max-width: 820px; width: 100%; margin: 0 auto;
  padding: 8px 24px 32px; display: flex; flex-direction: column;
}
.section-title {
  font-size: 9px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.6px; padding: 14px 0 6px;
  font-family: monospace;
}
.stat-grid {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.loading { color: var(--text-muted); font-size: 12px; padding: 16px; text-align: center; }
.dash-footer {
  border-top: 1px solid var(--border-subtle); margin-top: 16px; padding: 10px 0 0;
  font-size: 9px; color: var(--text-muted); font-family: monospace;
}
</style>