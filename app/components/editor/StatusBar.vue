<!-- app/components/editor/StatusBar.vue -->
<template>
  <footer class="status-bar" aria-label="Editor status">
    <div class="status-left">
      <span class="ready-indicator" aria-hidden="true" />
      <span class="status-message" :title="editor.statusMessage">{{ editor.statusMessage }}</span>
    </div>

    <div class="status-right">
      <span class="status-item network-status" :style="{ color: offlineStore.statusColor }" :title="offlineStore.statusLabel">
        <span class="status-dot" :class="offlineStore.networkStatus" aria-hidden="true" />
        <span class="status-text">{{ offlineStore.statusLabel }}</span>
      </span>

      <span class="status-separator" aria-hidden="true" />

      <span class="status-item save-status" :class="project.saveStatus" :title="saveLabel">
        {{ saveLabel }}
      </span>

      <button type="button" class="status-control optional-control" title="Export project" aria-label="Export project" @click="exportStore.openDialog()">
        <Download :size="12" :stroke-width="2" aria-hidden="true" /><span class="status-text">Export</span>
      </button>

      <button type="button" class="status-control optional-control" title="Manage plugins" aria-label="Manage plugins" @click="pluginUI.open()">
        <Puzzle :size="12" :stroke-width="2" aria-hidden="true" /><span class="status-text">Plugins</span>
      </button>

      <button type="button" class="status-control" title="Collaboration" aria-label="Open collaboration panel" @click="collabUI.open()">
        <span class="collab-dot" :class="{ active: inRoom }" aria-hidden="true" />
        <span class="status-text">{{ inRoom ? `Room ${roomId}` : 'Collaborate' }}</span>
      </button>

      <button
        type="button"
        class="status-control project-control"
        :title="`Open projects — ${project.activeProjectName}`"
        aria-label="Open project explorer"
        @click="project.isExplorerOpen = true"
      >
        <FolderOpen :size="12" :stroke-width="2" aria-hidden="true" />
        <span class="project-label">{{ project.activeProjectName }}</span>
      </button>

      <span class="zoom-label" title="Current canvas zoom">{{ Math.round(editor.zoom * 100) }}%</span>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Download, Puzzle, FolderOpen } from 'lucide-vue-next'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'
import { useOfflineStore } from '~/stores/offline'
import { useExportStore } from '~/stores/export'
import { useCollaborationUIStore } from '~/stores/collaborationUI'
import { usePluginUIStore } from '~/stores/pluginUI'
import { webRTCManager } from '~~/src/collaboration/webrtc/WebRTCManager'

const editor = useEditorStore()
const project = useProjectStore()
const offlineStore = useOfflineStore()
const exportStore = useExportStore()
const collabUI = useCollaborationUIStore()
const pluginUI = usePluginUIStore()

const inRoom = computed(() => webRTCManager.isInRoom)
const roomId = computed(() => webRTCManager.roomId ?? '')

const saveLabel = computed(() => {
  switch (project.saveStatus) {
    case 'saving': return 'Saving…'
    case 'saved': return 'Saved'
    case 'unsaved': return 'Unsaved'
    case 'error': return 'Save failed'
    default: return ''
  }
})
</script>

<style scoped>
.status-bar {
  height: var(--statusbar-height);
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10px;
  overflow: hidden;
  border-top: 1px solid var(--border);
  background: var(--surface-0);
  color: var(--text-muted);
  font: 500 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
  z-index: var(--z-floating);
}

.status-left,
.status-right,
.status-item,
.status-control {
  display: flex;
  align-items: center;
}

.status-left { min-width: 0; gap: 7px; flex: 1; }
.status-right { min-width: 0; gap: 6px; flex-shrink: 0; }
.ready-indicator { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 3px rgba(52,211,153,0.1); flex-shrink: 0; }
.status-message { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); }
.status-item { gap: 5px; white-space: nowrap; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
.status-dot.online { background: var(--success); }
.status-dot.offline { background: var(--danger); }
.status-dot.reconnecting { background: var(--warning); }
.status-separator { width: 1px; height: 14px; background: var(--border); margin: 0 2px; }
.save-status.saved { color: var(--success); }
.save-status.unsaved { color: var(--warning); }
.save-status.saving { color: var(--text-muted); }
.save-status.error { color: var(--danger); }

.status-control {
  gap: 5px;
  height: 22px;
  max-width: 170px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
}

.status-control:hover { border-color: var(--border); background: var(--hover); color: var(--text-primary); }
.collab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
.collab-dot.active { background: var(--success); box-shadow: 0 0 0 3px rgba(52,211,153,0.1); }
.project-label { display: block; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zoom-label { min-width: 42px; padding-left: 3px; color: var(--text-secondary); text-align: right; }

@media (max-width: 980px) {
  .optional-control { display: none; }
}

@media (max-width: 700px) {
  .project-control,
  .network-status .status-text { display: none; }
  .status-bar { padding-inline: 7px; }
}
</style>
