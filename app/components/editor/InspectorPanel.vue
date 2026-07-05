<!-- app/components/editor/InspectorPanel.vue -->
<template>
  <aside v-if="editor.rightPanelOpen" class="inspector-panel" aria-label="Inspector">
    <div class="panel-header">
      <div>
        <span class="panel-kicker">Properties</span>
        <strong>Inspector</strong>
      </div>
      <span v-if="sel" class="type-badge">{{ sel.type }}</span>
    </div>

    <div class="panel-body">
      <div v-if="!sel" class="empty-state">
        <div class="empty-icon" aria-hidden="true">◇</div>
        <strong>Nothing selected</strong>
        <p>Select an object on the canvas or from the Layers panel to inspect its properties.</p>
      </div>

      <template v-else>
        <section class="property-section">
          <div class="section-title">Object</div>
          <div class="prop-group">
            <div class="prop-label">Name</div>
            <div class="prop-value strong">{{ sel.name }}</div>
          </div>
          <div class="state-row">
            <span class="state-pill" :class="{ active: sel.visible }">
              {{ sel.visible ? 'Visible' : 'Hidden' }}
            </span>
            <span class="state-pill" :class="{ warning: sel.locked }">
              {{ sel.locked ? 'Locked' : 'Editable' }}
            </span>
          </div>
        </section>

        <section class="property-section">
          <div class="section-title">Transform</div>
          <div class="property-grid">
            <div class="prop-group compact">
              <div class="prop-label">X</div>
              <div class="prop-value mono">{{ Math.round(sel.x) }}</div>
            </div>
            <div class="prop-group compact">
              <div class="prop-label">Y</div>
              <div class="prop-value mono">{{ Math.round(sel.y) }}</div>
            </div>
            <div class="prop-group compact">
              <div class="prop-label">W</div>
              <div class="prop-value mono">{{ Math.round(sel.width) }}</div>
            </div>
            <div class="prop-group compact">
              <div class="prop-label">H</div>
              <div class="prop-value mono">{{ Math.round(sel.height) }}</div>
            </div>
          </div>
        </section>

        <section class="property-section">
          <div class="section-title">Appearance</div>
          <div class="prop-group">
            <div class="prop-label">Fill</div>
            <div class="prop-value color-row">
              <span class="color-swatch" :style="{ background: sel.fill }" />
              <span class="mono">{{ sel.fill }}</span>
            </div>
          </div>
          <div class="prop-group">
            <div class="prop-label">Opacity</div>
            <div class="opacity-display">
              <div class="opacity-track">
                <span :style="{ width: `${Math.round(sel.opacity * 100)}%` }" />
              </div>
              <span class="mono">{{ Math.round(sel.opacity * 100) }}%</span>
            </div>
          </div>
        </section>

        <div v-if="sel.locked" class="lock-notice">
          Unlock this object from the Layers panel before editing it.
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '~/stores/editor'
import { useSelectionStore } from '~/stores/selection'

const editor = useEditorStore()
const selStore = useSelectionStore()
const sel = computed(() => selStore.selectedObject)
</script>

<style scoped>
.inspector-panel {
  width: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-1);
  border-left: 1px solid var(--border);
}

.panel-header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.015), transparent);
}

.panel-header > div { display: flex; flex-direction: column; gap: 1px; }
.panel-kicker { color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: 0.11em; }
.panel-header strong { color: var(--text-primary); font-size: 13px; font-weight: 650; }
.type-badge {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 8px;
  border: 1px solid rgba(129, 140, 248, 0.25);
  border-radius: 999px;
  background: var(--accent-soft);
  color: #cfd2ff;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
}

.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 18px;
  text-align: center;
}

.empty-icon {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  margin-bottom: 4px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface-2);
  color: var(--accent);
  font-size: 24px;
}

.empty-state strong { color: var(--text-secondary); font-size: 13px; }
.empty-state p { max-width: 205px; margin: 0; color: var(--text-muted); font-size: 11px; line-height: 1.6; }

.property-section {
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: rgba(8, 12, 19, 0.36);
}

.section-title {
  margin-bottom: 11px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.prop-group { margin-bottom: 10px; }
.prop-group:last-child { margin-bottom: 0; }
.prop-label { margin-bottom: 5px; color: var(--text-muted); font-size: 10px; }

.prop-value {
  min-height: 32px;
  display: flex;
  align-items: center;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-0);
  color: var(--text-secondary);
  font-size: 11px;
}

.prop-value.strong { color: var(--text-primary); font-weight: 600; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
.property-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.prop-group.compact { margin: 0; }

.state-row { display: flex; flex-wrap: wrap; gap: 6px; }
.state-pill {
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 9px;
}
.state-pill.active { border-color: rgba(52, 211, 153, 0.28); background: rgba(52, 211, 153, 0.08); color: var(--success); }
.state-pill.warning { border-color: rgba(251, 191, 36, 0.28); background: rgba(251, 191, 36, 0.08); color: var(--warning); }

.color-row { gap: 8px; }
.color-swatch { width: 18px; height: 18px; border: 1px solid rgba(255,255,255,0.16); border-radius: 5px; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.18); }
.opacity-display { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.opacity-track { height: 6px; overflow: hidden; border-radius: 999px; background: var(--surface-3); }
.opacity-track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent-strong), #a78bfa); }
.lock-notice { padding: 10px 11px; border: 1px solid rgba(251,191,36,0.2); border-radius: var(--radius-sm); background: rgba(251,191,36,0.07); color: #d7bd76; font-size: 10px; line-height: 1.5; }

@media (max-width: 860px) {
  .inspector-panel {
    position: absolute;
    z-index: var(--z-panel);
    top: var(--toolbar-height);
    right: 0;
    bottom: var(--statusbar-height);
    width: min(var(--right-sidebar-width), 84vw);
    box-shadow: var(--shadow-panel);
  }
}
</style>
