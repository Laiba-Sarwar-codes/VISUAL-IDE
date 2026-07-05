<!-- app/components/editor/EditorShell.vue -->
<template>
  <div class="editor-shell">
    <Toolbar />

    <div
      class="editor-body"
      :class="{
        'left-panel-closed': !editor.leftPanelOpen,
        'right-panel-closed': !editor.rightPanelOpen,
      }"
    >
      <aside v-if="editor.leftPanelOpen" class="left-sidebar" aria-label="Layers and assets">
        <LayerPanel />
        <AssetPanel />
      </aside>

      <main class="workspace-column" aria-label="Visual editor canvas">
        <CanvasWorkspace />
      </main>

      <InspectorPanel />
    </div>

    <StatusBar />
  </div>
</template>

<script setup lang="ts">
import Toolbar from '~/components/editor/Toolbar.vue'
import LayerPanel from '~/components/panels/LayerPanel.vue'
import AssetPanel from '~/components/panels/AssetPanel.vue'
import CanvasWorkspace from '~/components/canvas/CanvasWorkspace.vue'
import InspectorPanel from '~/components/editor/InspectorPanel.vue'
import StatusBar from '~/components/editor/StatusBar.vue'
import { useAutosave } from '~/composables/useAutosave'
import { useEditorStore } from '~/stores/editor'

const editor = useEditorStore()
useAutosave()
</script>

<style scoped>
.editor-shell {
  display: grid;
  grid-template-rows: var(--toolbar-height) minmax(0, 1fr) var(--statusbar-height);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--app-bg);
}

.editor-body {
  display: grid;
  grid-template-columns: var(--left-sidebar-width) minmax(0, 1fr) var(--right-sidebar-width);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.editor-body.left-panel-closed {
  grid-template-columns: minmax(0, 1fr) var(--right-sidebar-width);
}

.editor-body.right-panel-closed {
  grid-template-columns: var(--left-sidebar-width) minmax(0, 1fr);
}

.editor-body.left-panel-closed.right-panel-closed {
  grid-template-columns: minmax(0, 1fr);
}

.left-sidebar {
  display: grid;
  grid-template-rows: minmax(150px, 1fr) minmax(170px, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--surface-1);
  border-right: 1px solid var(--border);
}

.workspace-column {
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--canvas-bg);
}

@media (max-width: 860px) {
  .editor-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .left-sidebar {
    position: absolute;
    z-index: var(--z-panel);
    top: var(--toolbar-height);
    bottom: var(--statusbar-height);
    left: 0;
    width: min(var(--left-sidebar-width), 82vw);
    box-shadow: var(--shadow-panel);
  }
}
</style>
