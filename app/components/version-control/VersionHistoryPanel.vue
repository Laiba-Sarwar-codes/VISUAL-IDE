<!-- app/components/version-control/VersionHistoryPanel.vue -->
<!-- Module 20 — commit history, branches, restore -->
<template>
  <div v-if="vc.isPanelOpen" class="vc-overlay">
    <div class="vc-panel">

      <PageHeader
        :icon="GitBranch"
        title="Version History"
        description="Commit snapshots of the scene, switch branches, and restore any previous commit."
        @back="vc.closePanel()"
      />

      <div class="vc-body">
        <!-- Branch selector + create -->
        <div class="branch-row">
          <label class="branch-label">Branch:</label>
          <select
            class="branch-select"
            :value="vc.currentBranchId ?? ''"
            @change="vc.switchBranch(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="b in vc.branches" :key="b.id" :value="b.id">
              {{ b.name }}
            </option>
          </select>
          <button class="new-branch-btn" @click="handleCreateBranch">+ Branch</button>
        </div>

        <!-- New commit form -->
        <div class="commit-form">
          <input
            v-model="newMessage"
            class="commit-input"
            placeholder="Commit message…"
            @keydown.enter="handleCommit"
          />
          <button
            class="commit-btn"
            :disabled="!newMessage.trim()"
            @click="handleCommit"
          >
            💾 Commit
          </button>
        </div>

        <!-- Commit history -->
        <div class="history">
          <div class="history-header">
            {{ vc.branchCommits.length }} commit{{ vc.branchCommits.length !== 1 ? 's' : '' }} on
            <strong>{{ vc.currentBranch?.name ?? '' }}</strong>
          </div>

          <p v-if="vc.branchCommits.length === 0" class="empty">
            No commits yet. Create the first one above.
          </p>

          <div
            v-for="commit in vc.branchCommits"
            :key="commit.id"
            class="commit-row"
            :class="{ current: commit.id === vc.currentCommitId }"
          >
            <div class="commit-info">
              <div class="commit-msg">{{ commit.message }}</div>
              <div class="commit-meta">
                <span class="commit-id">{{ commit.id.slice(0, 7) }}</span>
                <span class="commit-date">{{ formatDate(commit.createdAt) }}</span>
                <span class="commit-author">by {{ commit.author }}</span>
              </div>
              <div class="commit-stats">
                <span v-if="commit.stats.added > 0" class="stat added">+{{ commit.stats.added }}</span>
                <span v-if="commit.stats.removed > 0" class="stat removed">-{{ commit.stats.removed }}</span>
                <span v-if="commit.stats.modified > 0" class="stat modified">~{{ commit.stats.modified }}</span>
              </div>
            </div>
            <button
              v-if="commit.id !== vc.currentCommitId"
              class="restore-btn"
              @click="handleRestore(commit.id, commit.message)"
            >Restore</button>
            <span v-else class="current-badge">HEAD</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { GitBranch } from 'lucide-vue-next'
import { useVersionControlStore } from '~/stores/versionControl'
import { useEditorStore } from '~/stores/editor'
import PageHeader from '~/components/app-shell/PageHeader.vue'

const vc = useVersionControlStore()
const editor = useEditorStore()
const newMessage = ref('')

function handleCommit(): void {
  if (!newMessage.value.trim()) return
  const commit = vc.createCommit(newMessage.value)
  if (commit) {
    editor.setStatusMessage(`Committed: ${commit.message}`)
    newMessage.value = ''
  }
}

function handleRestore(commitId: string, message: string): void {
  if (!confirm(`Restore commit "${message}"? Current unsaved changes will be replaced.`)) return
  const ok = vc.restoreCommit(commitId)
  editor.setStatusMessage(ok ? `Restored: ${message}` : 'Restore failed')
}

function handleCreateBranch(): void {
  const name = prompt('New branch name:')
  if (!name?.trim()) return
  const ok = vc.createBranch(name.trim())
  if (!ok) alert(`Branch "${name}" already exists.`)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped>
.vc-overlay {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.vc-panel {
  display: flex; flex-direction: column; flex: 1; min-height: 0;
}
.vc-body {
  max-width: 720px; width: 100%; margin: 0 auto;
  padding: 20px 24px 32px; display: flex; flex-direction: column; gap: 14px; min-height: 0;
}
.branch-row { display: flex; align-items: center; gap: 8px; }
.branch-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.branch-select {
  flex: 1; background: var(--surface-0); border: 1px solid var(--border); color: var(--text-primary);
  font-size: 12px; padding: 5px 8px; border-radius: 6px;
}
.new-branch-btn {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-secondary); font-size: 11px; padding: 5px 10px; cursor: pointer;
}
.new-branch-btn:hover { background: var(--hover); }
.commit-form { display: flex; gap: 8px; }
.commit-input {
  flex: 1; background: var(--surface-0); border: 1px solid var(--border); color: var(--text-primary);
  font-size: 13px; padding: 8px 10px; border-radius: 6px; outline: none;
}
.commit-input:focus { border-color: var(--accent); }
.commit-btn {
  background: var(--accent); border: none; border-radius: 6px;
  color: #ffffff; font-size: 12px; padding: 0 14px; cursor: pointer;
}
.commit-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.history { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.history-header {
  font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;
}
.empty { color: var(--text-muted); font-size: 12px; font-style: italic; text-align: center; padding: 16px; }
.commit-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface-0); border-left: 3px solid var(--border);
  border-radius: 6px; padding: 10px 12px;
}
.commit-row.current { border-left-color: var(--accent); background: var(--accent-soft); }
.commit-info { flex: 1; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
.commit-msg { font-size: 13px; color: var(--text-primary); }
.commit-meta { display: flex; gap: 8px; font-size: 10px; color: var(--text-muted); font-family: monospace; }
.commit-id { color: var(--accent); }
.commit-stats { display: flex; gap: 6px; font-size: 10px; font-family: monospace; margin-top: 2px; }
.stat.added    { color: var(--success); }
.stat.removed  { color: var(--danger); }
.stat.modified { color: var(--warning); }
.restore-btn {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px;
  color: var(--text-secondary); font-size: 11px; padding: 4px 10px; cursor: pointer;
}
.restore-btn:hover { background: var(--accent); color: #ffffff; border-color: var(--accent); }
.current-badge {
  font-size: 10px; color: var(--accent); background: var(--accent-soft);
  padding: 2px 8px; border-radius: 4px; font-family: monospace;
}
</style>