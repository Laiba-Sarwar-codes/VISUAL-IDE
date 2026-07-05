<!-- app/components/layers/LayerToolbar.vue -->
<!-- Layer Management — create folder, group/ungroup, align, distribute -->
<template>
  <div class="layer-toolbar" role="toolbar" aria-label="Layer actions">
    <button type="button" class="tb-btn" title="New folder" aria-label="New folder" @click="handleCreateFolder">
      📁
    </button>
    <button
      type="button"
      class="tb-btn"
      title="Group (Ctrl/Cmd+G)"
      aria-label="Group selection"
      :disabled="selection.selectedIds.length < 2"
      @click="handleGroup"
    >
      ⧉
    </button>
    <button
      type="button"
      class="tb-btn"
      title="Ungroup (Ctrl/Cmd+Shift+G)"
      aria-label="Ungroup selection"
      :disabled="!canUngroup"
      @click="handleUngroup"
    >
      ⧉⃠
    </button>

    <div class="tb-sep" aria-hidden="true" />

    <button type="button" class="tb-btn" title="Align left" aria-label="Align left" :disabled="!canAlign" @click="align('left')">⇤</button>
    <button type="button" class="tb-btn" title="Align center" aria-label="Align horizontal center" :disabled="!canAlign" @click="align('hcenter')">⇹</button>
    <button type="button" class="tb-btn" title="Align right" aria-label="Align right" :disabled="!canAlign" @click="align('right')">⇥</button>
    <button type="button" class="tb-btn" title="Align top" aria-label="Align top" :disabled="!canAlign" @click="align('top')">⇞</button>
    <button type="button" class="tb-btn" title="Align middle" aria-label="Align vertical center" :disabled="!canAlign" @click="align('vcenter')">⇳</button>
    <button type="button" class="tb-btn" title="Align bottom" aria-label="Align bottom" :disabled="!canAlign" @click="align('bottom')">⇟</button>

    <div class="tb-sep" aria-hidden="true" />

    <button type="button" class="tb-btn" title="Distribute horizontally" aria-label="Distribute horizontally" :disabled="!canDistribute" @click="distribute('horizontal')">⇔</button>
    <button type="button" class="tb-btn" title="Distribute vertically" aria-label="Distribute vertically" :disabled="!canDistribute" @click="distribute('vertical')">⇕</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'

const scene = useSceneStore()
const selection = useSelectionStore()

const canUngroup = computed(() =>
  selection.selectedIds.some(id => scene.objects.find(o => o.id === id)?.type === 'group')
)
const canAlign = computed(() => selection.selectedIds.length >= 2)
const canDistribute = computed(() => selection.selectedIds.length >= 3)

function handleCreateFolder(): void {
  scene.createFolder('New Folder')
}

function handleGroup(): void {
  if (selection.selectedIds.length < 2) return
  const groupId = scene.groupSelected(selection.selectedIds)
  if (groupId) selection.select(groupId)
}

function handleUngroup(): void {
  const groupId = selection.selectedIds.find(id => scene.objects.find(o => o.id === id)?.type === 'group')
  if (groupId) scene.ungroupSelected(groupId)
}

function align(edge: 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter'): void {
  if (selection.selectedIds.length < 2) return
  scene.alignSelected(selection.selectedIds, edge)
}

function distribute(axis: 'horizontal' | 'vertical'): void {
  if (selection.selectedIds.length < 3) return
  scene.distributeSelected(selection.selectedIds, axis)
}
</script>

<style scoped>
.layer-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 7px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-1);
}
.tb-btn {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
}
.tb-btn:hover:not(:disabled) { border-color: rgba(129,140,248,0.35); background: var(--accent-soft); color: #e0e2ff; }
.tb-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.tb-sep { width: 1px; height: 18px; margin: 0 2px; background: var(--border); }
</style>
