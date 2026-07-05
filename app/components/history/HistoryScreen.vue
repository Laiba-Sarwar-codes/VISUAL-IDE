<!-- app/components/history/HistoryScreen.vue -->
<!-- UI redesign — new dedicated screen for Module 4 (History Engine).
     No new history logic: undo/redo call the existing useHistoryStore()
     actions (HistoryManager underneath), and the entry list is read
     read-only from PersistentHistoryService via useHistoryEntries(). -->
<template>
  <div v-if="nav.activeScreen === 'history'" class="history-overlay">
    <PageHeader
      :icon="History"
      title="History"
      description="Undo and redo scene edits. The list below shows real recorded transactions."
      @back="nav.goToCanvas()"
    />

    <div class="history-body">
      <div class="controls-row">
        <button class="ctrl-btn" :disabled="!history.canUndo" @click="history.undo()">
          <Undo2 :size="15" :stroke-width="2" />
          <span>Undo{{ history.undoLabel ? `: ${history.undoLabel}` : '' }}</span>
        </button>
        <button class="ctrl-btn" :disabled="!history.canRedo" @click="history.redo()">
          <Redo2 :size="15" :stroke-width="2" />
          <span>Redo{{ history.redoLabel ? `: ${history.redoLabel}` : '' }}</span>
        </button>
        <span class="stack-size">{{ history.stackSize }} step{{ history.stackSize === 1 ? '' : 's' }} in stack</span>
      </div>

      <div class="section-title">Recorded Transactions</div>

      <p v-if="!available" class="empty">
        Persistent history isn't available yet — open a project to start recording transactions.
      </p>
      <p v-else-if="entries.length === 0" class="empty">
        No transactions recorded yet. Draw or edit something to see it here.
      </p>

      <div v-else class="entry-list">
        <div
          v-for="(entry, i) in entries"
          :key="entry.id"
          class="entry-row"
          :class="{ current: i === cursor - 1 }"
        >
          <span class="entry-index">{{ i + 1 }}</span>
          <span class="entry-label">{{ entry.label }}</span>
          <span class="entry-time">{{ formatTime(entry.createdAt) }}</span>
          <span v-if="i === cursor - 1" class="current-badge">HEAD</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { History, Undo2, Redo2 } from 'lucide-vue-next'
import { useNavigationStore } from '~/stores/navigation'
import { useHistoryStore } from '~/stores/history'
import { useHistoryEntries } from '~/composables/useHistoryEntries'
import PageHeader from '~/components/app-shell/PageHeader.vue'

const nav = useNavigationStore()
const history = useHistoryStore()
const { entries, cursor, available } = useHistoryEntries()

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
</script>

<style scoped>
.history-overlay {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.history-body {
  max-width: 720px; width: 100%; margin: 0 auto;
  padding: 20px 24px 32px; display: flex; flex-direction: column; gap: 10px;
}
.controls-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.ctrl-btn {
  display: flex; align-items: center; gap: 6px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-secondary); font-size: 12px; padding: 7px 12px; cursor: pointer;
}
.ctrl-btn:hover:not(:disabled) { background: var(--hover); color: var(--text-primary); }
.ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.stack-size { margin-left: auto; font-size: 11px; color: var(--text-muted); }
.section-title {
  font-size: 10px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.5px; margin-top: 8px;
}
.empty { color: var(--text-muted); font-size: 12px; font-style: italic; text-align: center; padding: 20px; }
.entry-list { display: flex; flex-direction: column; gap: 4px; }
.entry-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--surface-0); border-left: 3px solid var(--border);
  border-radius: 6px; padding: 8px 12px; font-size: 12px;
}
.entry-row.current { border-left-color: var(--accent); background: var(--accent-soft); }
.entry-index { color: var(--text-muted); font-family: monospace; font-size: 11px; width: 24px; flex-shrink: 0; }
.entry-label { flex: 1; color: var(--text-primary); }
.entry-time { color: var(--text-muted); font-family: monospace; font-size: 11px; }
.current-badge {
  font-size: 10px; color: var(--accent); background: var(--accent-soft);
  padding: 2px 8px; border-radius: 4px; font-family: monospace;
}
</style>
