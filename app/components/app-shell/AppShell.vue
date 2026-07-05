<!-- app/components/app-shell/AppShell.vue -->
<!-- UI redesign — new root layout. The canvas/editor (`EditorShell`) is
     NEVER unmounted by navigation (v-show, not v-if) — this is the single
     most important safety property of this redesign, since CanvasWorkspace
     owns a Renderer instance, worker listeners, and a useCollaboration()
     lifecycle that must not be torn down by switching screens. Dedicated
     screens render as opaque layers on top of it, inside `.app-content`,
     so the navigation rail stays visible and usable from every screen. -->
<template>
  <div class="app-shell">
    <AppSidebar />

    <div class="app-content">
      <EditorShell v-show="nav.activeScreen === 'canvas'" />

      <AIWorkflowPanel />
      <MonitoringDashboard />
      <VersionHistoryPanel />
      <ExportDialog />
      <CollaborationPanel />
      <PluginPanel />
      <HistoryScreen />
      <SettingsScreen />
    </div>

    <CommandPalette />
    <ProjectExplorer />
  </div>
</template>

<script setup lang="ts">
import { useNavigationStore } from '~/stores/navigation'
import AppSidebar from './AppSidebar.vue'
import EditorShell from '~/components/editor/EditorShell.vue'
import ProjectExplorer from '~/components/editor/ProjectExplorer.vue'
import CommandPalette from '~/components/command-palette/CommandPalette.vue'
import AIWorkflowPanel from '~/components/ai/AIWorkflowPanel.vue'
import VersionHistoryPanel from '~/components/version-control/VersionHistoryPanel.vue'
import MonitoringDashboard from '~/components/monitoring/MonitoringDashboard.vue'
import ExportDialog from '~/components/editor/ExportDialog.vue'
import CollaborationPanel from '~/components/collaboration/CollaborationPanel.vue'
import PluginPanel from '~/components/editor/PluginPanel.vue'
import HistoryScreen from '~/components/history/HistoryScreen.vue'
import SettingsScreen from '~/components/settings/SettingsScreen.vue'

const nav = useNavigationStore()
</script>

<style scoped>
.app-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--app-bg);
}

.app-content {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
