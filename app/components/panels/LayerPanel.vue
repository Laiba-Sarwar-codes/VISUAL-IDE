<!-- app/components/panels/LayerPanel.vue -->
<template>
  <section class="layer-panel" aria-label="Layers">
    <div class="panel-header">
      <div class="panel-heading">
        <span class="panel-kicker">Document</span>
        <strong>Layers</strong>
      </div>
      <span class="layer-count">{{ scene.objects.length }}</span>
    </div>

    <LayerToolbar />

    <div class="panel-body">
      <div v-if="scene.objects.length === 0" class="placeholder-state">
        <div class="placeholder-icon" aria-hidden="true">▱</div>
        <strong>No layers yet</strong>
        <p>Choose a shape tool and click the canvas to add your first object.</p>
      </div>

      <LayerTree v-else />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useSceneStore } from '~/stores/scene'
import LayerTree from '~/components/layers/LayerTree.vue'
import LayerToolbar from '~/components/layers/LayerToolbar.vue'

const scene = useSceneStore()
</script>

<style scoped>
.layer-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-1);
  border-bottom: 1px solid var(--border);
}

.panel-header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 13px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.015), transparent);
  flex-shrink: 0;
}

.panel-heading { display: flex; flex-direction: column; gap: 1px; }
.panel-kicker { color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: 0.11em; }
.panel-heading strong { color: var(--text-primary); font-size: 13px; font-weight: 650; }
.layer-count { min-width: 24px; height: 22px; display: grid; place-items: center; padding: 0 7px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-2); color: var(--text-secondary); font: 600 10px/1 ui-monospace, monospace; }

.panel-body { flex: 1; min-height: 0; overflow-y: auto; padding: 7px; }
.placeholder-state { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 22px 18px; text-align: center; }
.placeholder-icon { width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 3px; border: 1px solid var(--border); border-radius: 13px; background: var(--surface-2); color: var(--accent); font-size: 19px; }
.placeholder-state strong { color: var(--text-secondary); font-size: 12px; }
.placeholder-state p { max-width: 185px; margin: 0; color: var(--text-muted); font-size: 10px; line-height: 1.55; }
</style>
