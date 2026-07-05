<!-- app/components/editor/Toolbar.vue -->
<template>
  <header class="toolbar" aria-label="Editor toolbar">
    <div class="brand" aria-label="Collab Visual IDE">
      <div class="brand-mark" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div class="brand-copy">
        <strong>Collab IDE</strong>
        <span>Visual workspace</span>
      </div>
    </div>

    <div class="toolbar-divider" aria-hidden="true" />

    <div class="toolbar-group tool-group" aria-label="Canvas tools">
      <button
        v-for="tool in tools"
        :key="tool.id"
        type="button"
        class="toolbar-btn tool-btn"
        :class="{ active: editor.activeTool === tool.id }"
        :title="tool.label"
        :aria-label="tool.label"
        :aria-pressed="editor.activeTool === tool.id"
        @click="editor.setTool(tool.id)"
      >
        <component :is="tool.icon" class="tool-icon" :size="15" :stroke-width="2" aria-hidden="true" />
        <span class="tool-name">{{ tool.shortLabel }}</span>
      </button>
    </div>

    <button
      type="button"
      class="project-chip"
      title="Open projects"
      aria-label="Open project explorer"
      @click="project.isExplorerOpen = true"
    >
      <span class="project-dot" aria-hidden="true" />
      <span class="project-name">{{ project.activeProjectName }}</span>
      <ChevronDown class="project-chevron" :size="13" :stroke-width="2" aria-hidden="true" />
    </button>

    <div class="toolbar-group toolbar-group--right">
      <button
        type="button"
        class="toolbar-btn compact"
        :disabled="!history.canUndo"
        :title="history.undoLabel ? `Undo: ${history.undoLabel}` : 'Nothing to undo'"
        aria-label="Undo"
        @click="history.undo()"
      ><Undo2 :size="16" :stroke-width="2" /></button>

      <button
        type="button"
        class="toolbar-btn compact"
        :disabled="!history.canRedo"
        :title="history.redoLabel ? `Redo: ${history.redoLabel}` : 'Nothing to redo'"
        aria-label="Redo"
        @click="history.redo()"
      ><Redo2 :size="16" :stroke-width="2" /></button>

      <div class="toolbar-divider small" aria-hidden="true" />

      <button
        type="button"
        class="toolbar-btn compact panel-toggle"
        :class="{ active: editor.leftPanelOpen }"
        title="Toggle layers and assets"
        aria-label="Toggle layers and assets panel"
        :aria-pressed="editor.leftPanelOpen"
        @click="editor.toggleLeftPanel()"
      ><PanelLeft :size="16" :stroke-width="2" /></button>

      <button
        type="button"
        class="toolbar-btn compact panel-toggle"
        :class="{ active: editor.rightPanelOpen }"
        title="Toggle inspector"
        aria-label="Toggle inspector panel"
        :aria-pressed="editor.rightPanelOpen"
        @click="editor.toggleRightPanel()"
      ><PanelRight :size="16" :stroke-width="2" /></button>

      <span class="zoom-chip" title="Current canvas zoom">
        {{ Math.round(editor.zoom * 100) }}%
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { MousePointer2, Hand, Square, Circle, Type, Undo2, Redo2, PanelLeft, PanelRight, ChevronDown } from 'lucide-vue-next'
import { useEditorStore } from '~/stores/editor'
import { useHistoryStore } from '~/stores/history'
import { useProjectStore } from '~/stores/project'
import type { ToolId } from '~~/src/state-manager/types'

const editor = useEditorStore()
const history = useHistoryStore()
const project = useProjectStore()

const tools: { id: ToolId; label: string; shortLabel: string; icon: Component }[] = [
  { id: 'select', label: 'Select', shortLabel: 'Select', icon: MousePointer2 },
  { id: 'pan', label: 'Pan canvas', shortLabel: 'Pan', icon: Hand },
  { id: 'rectangle', label: 'Rectangle', shortLabel: 'Rect', icon: Square },
  { id: 'ellipse', label: 'Ellipse', shortLabel: 'Ellipse', icon: Circle },
  { id: 'text', label: 'Text', shortLabel: 'Text', icon: Type },
]
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--toolbar-height);
  min-width: 0;
  padding: 0 14px;
  background: linear-gradient(180deg, var(--surface-2) 0%, var(--surface-1) 100%);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.02);
  z-index: var(--z-floating);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 148px;
  flex-shrink: 0;
}

.brand-mark {
  position: relative;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  background: linear-gradient(145deg, #8b8fff, #5c61e8);
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.28);
  overflow: hidden;
}

.brand-mark span {
  position: absolute;
  width: 8px;
  height: 8px;
  border: 2px solid rgba(255, 255, 255, 0.94);
  border-radius: 2px;
}

.brand-mark span:nth-child(1) { left: 6px; top: 6px; }
.brand-mark span:nth-child(2) { right: 6px; top: 6px; }
.brand-mark span:nth-child(3) { left: 11px; bottom: 5px; }

.brand-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.1;
}

.brand-copy strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.brand-copy span {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 10px;
  white-space: nowrap;
}

.toolbar-divider {
  width: 1px;
  height: 28px;
  flex: 0 0 1px;
  background: var(--border);
}

.toolbar-divider.small { height: 24px; margin: 0 2px; }

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.tool-group {
  padding: 4px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: rgba(5, 8, 13, 0.34);
}

.toolbar-group--right {
  margin-left: auto;
  flex-shrink: 0;
}

.toolbar-btn {
  height: 34px;
  min-width: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease, transform 120ms ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--hover);
  color: var(--text-primary);
}

.toolbar-btn:active:not(:disabled) { transform: translateY(1px); }

.toolbar-btn.active {
  border-color: rgba(129, 140, 248, 0.38);
  background: var(--accent-soft);
  color: #dfe1ff;
  box-shadow: inset 0 0 0 1px rgba(129, 140, 248, 0.08);
}

.toolbar-btn:disabled {
  opacity: 0.28;
  cursor: not-allowed;
}

.toolbar-btn.compact {
  width: 34px;
  padding: 0;
  font-size: 17px;
}

.tool-icon {
  width: 17px;
  text-align: center;
  font-size: 15px;
  line-height: 1;
}

.tool-name {
  color: inherit;
  font-size: 11px;
  font-weight: 600;
}

.project-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 240px;
  height: 34px;
  margin-left: 2px;
  padding: 0 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: rgba(8, 12, 19, 0.58);
  color: var(--text-secondary);
  cursor: pointer;
}

.project-chip:hover {
  border-color: #3a4860;
  background: var(--hover);
  color: var(--text-primary);
}

.project-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(124, 131, 255, 0.12);
  flex-shrink: 0;
}

.project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 600;
}

.project-chevron { color: var(--text-muted); font-size: 12px; }

.zoom-chip {
  min-width: 56px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: rgba(8, 12, 19, 0.6);
  color: var(--text-secondary);
  font: 600 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (max-width: 1040px) {
  .tool-name,
  .brand-copy span { display: none; }
  .brand { min-width: 116px; }
  .toolbar-btn.tool-btn { width: 34px; padding: 0; }
  .project-chip { max-width: 160px; }
}

@media (max-width: 760px) {
  .brand-copy,
  .toolbar > .toolbar-divider:first-of-type,
  .project-chip { display: none; }
  .brand { min-width: auto; }
  .toolbar { gap: 7px; padding-inline: 8px; }
}
</style>
