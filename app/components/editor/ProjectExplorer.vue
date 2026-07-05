<!-- app/components/editor/ProjectExplorer.vue -->
<!-- Module 9 — project browser panel -->
<template>
  <div v-if="project.isExplorerOpen" class="explorer-overlay" @click.self="project.isExplorerOpen = false">
    <div class="explorer-panel">

      <div class="explorer-header">
        <span>Projects</span>
        <button class="close-btn" @click="project.isExplorerOpen = false">
          <X :size="16" :stroke-width="2" />
        </button>
      </div>

      <div class="explorer-actions">
        <button class="btn-primary" @click="handleNew">
          <Plus :size="14" :stroke-width="2" />
          <span>New Project</span>
        </button>
        <label class="btn-secondary">
          <Upload :size="14" :stroke-width="2" />
          <span>Import JSON</span>
          <input type="file" accept=".json" hidden @change="handleImport" />
        </label>
      </div>

      <div class="project-list">
        <p v-if="project.projects.length === 0" class="empty-text">
          No saved projects yet.
        </p>

        <div
          v-for="p in project.projects"
          :key="p.id"
          class="project-item"
          :class="{ active: p.id === project.activeProjectId }"
        >
          <div class="project-info" @click="handleLoad(p.id)">
            <span class="project-name">{{ p.name }}</span>
            <span class="project-meta">
              {{ p.objectCount }} objects · {{ formatDate(p.updatedAt) }}
            </span>
          </div>

          <div class="project-btns">
            <button title="Rename" @click="handleRename(p.id, p.name)">
              <Pencil :size="14" :stroke-width="2" />
            </button>
            <button title="Export JSON" @click="project.exportProject(p.id)">
              <Download :size="14" :stroke-width="2" />
            </button>
            <button title="Delete" class="danger" @click="handleDelete(p.id)">
              <Trash2 :size="14" :stroke-width="2" />
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { X, Plus, Upload, Pencil, Download, Trash2 } from 'lucide-vue-next'
import { useProjectStore } from '~/stores/project'
import { useSceneStore } from '~/stores/scene'
import { useEditorStore } from '~/stores/editor'
import { useHistoryStore } from '~/stores/history'

const project = useProjectStore()
const scene = useSceneStore()
const editor = useEditorStore()
const history = useHistoryStore()

onMounted(() => project.refreshProjects())

async function handleNew(): Promise<void> {
  scene.objects = []
  history.clear()
  await project.createProject()
  editor.setStatusMessage(`New project created`)
  project.isExplorerOpen = false
}

/**
 * Why: loading a project replaces the scene objects array and resets
 * history so the undo stack from the previous project doesn't carry over.
 */
async function handleLoad(id: string): Promise<void> {
  const loaded = await project.loadProject(id)
  if (!loaded) return
  scene.objects = loaded.objects
  history.clear()
  editor.setStatusMessage(`Loaded: ${loaded.name}`)
  project.isExplorerOpen = false
}

async function handleRename(id: string, current: string): Promise<void> {
  const name = prompt('Rename project:', current)
  if (name && name.trim()) await project.renameProject(id, name.trim())
}

async function handleDelete(id: string): Promise<void> {
  if (!confirm('Delete this project? This cannot be undone.')) return
  await project.deleteProject(id)
}

async function handleImport(e: Event): Promise<void> {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  await project.importProject(file)
  editor.setStatusMessage('Project imported')
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
.explorer-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: var(--z-panel); display: flex; align-items: center; justify-content: center;
}
.explorer-panel {
  background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px;
  width: 480px; max-height: 70vh; display: flex; flex-direction: column;
  overflow: hidden;
}
.explorer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
  font-size: 14px; font-weight: 600; color: var(--text-primary);
}
.close-btn {
  display: flex; background: none; border: none; color: var(--text-muted); cursor: pointer;
}
.close-btn:hover { color: var(--text-primary); }
.explorer-actions {
  display: flex; gap: 8px; padding: 12px 20px;
  border-bottom: 1px solid var(--border);
}
.btn-primary {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; background: var(--accent); border: none; border-radius: 6px;
  color: #ffffff; font-size: 12px; cursor: pointer;
}
.btn-primary:hover { background: var(--accent-strong); }
.btn-secondary {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-secondary); font-size: 12px; cursor: pointer;
}
.project-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.empty-text { color: var(--text-muted); font-size: 13px; padding: 20px; text-align: center; }
.project-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; border-bottom: 1px solid var(--border-subtle); cursor: pointer;
}
.project-item:hover { background: var(--hover); }
.project-item.active { background: var(--accent-soft); }
.project-info { flex: 1; }
.project-name { display: block; font-size: 13px; color: var(--text-primary); margin-bottom: 2px; }
.project-meta { font-size: 11px; color: var(--text-muted); }
.project-btns { display: flex; gap: 4px; }
.project-btns button {
  display: flex; background: none; border: none; cursor: pointer; color: var(--text-secondary);
  padding: 5px; opacity: 0.7; border-radius: 4px;
}
.project-btns button:hover { opacity: 1; background: var(--surface-2); }
.project-btns button.danger:hover { background: var(--danger-soft); color: var(--danger); }
</style>