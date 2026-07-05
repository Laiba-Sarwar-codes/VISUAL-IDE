<!-- app/app.vue -->
<!-- Module 22 — adds ExportDialog -->
<template>
  <div class="app-root">
    <AppShell />
  </div>
</template>

<script setup lang="ts">
import AppShell from '~/components/app-shell/AppShell.vue'
import { useHistoryShortcuts } from '~/composables/useHistoryShortcuts'
import { useLayerShortcuts } from '~/composables/useLayerShortcuts'
import { useTheme } from '~/composables/useTheme'
import { useHistoryStore } from '~/stores/history'
import { useCollaboration } from '~/composables/useCollaboration'
import { useOffline } from '~/composables/useOffline'
import { usePlugins } from '~/composables/usePlugins'
import { useCommandPalette } from '~/composables/useCommandPalette'
import { useVersionControl } from '~/composables/useVersionControl'
import { useMonitoring } from '~/composables/useMonitoring'
import { workerService } from '~~/src/services/WorkerService'
import { commandRegistry } from '~~/src/commands/CommandRegistry'
import { useExportStore } from '~/stores/export'

const history = useHistoryStore()
history.init()
useHistoryShortcuts()
useLayerShortcuts()
useTheme()
workerService.init()
useCollaboration()
useOffline()
usePlugins()
useCommandPalette()
useVersionControl()
useMonitoring()

const exportStore  = useExportStore()

// Export commands
commandRegistry.register({
  id: 'export:png',
  label: 'Export as PNG',
  category: 'Export',
  icon: '🖼',
  keywords: ['export', 'png', 'image', 'raster', 'download'],
  handler: () => {
    exportStore.setFormat('png')
    exportStore.openDialog()
  },
})

commandRegistry.register({
  id: 'export:svg',
  label: 'Export as SVG',
  category: 'Export',
  icon: '📐',
  keywords: ['export', 'svg', 'vector', 'download'],
  handler: () => {
    exportStore.setFormat('svg')
    exportStore.openDialog()
  },
})

commandRegistry.register({
  id: 'export:json',
  label: 'Export as JSON',
  category: 'Export',
  icon: '📄',
  keywords: ['export', 'json', 'data', 'backup', 'download'],
  handler: () => {
    exportStore.setFormat('json')
    exportStore.openDialog()
  },
})
</script>

<style scoped>
.app-root { height: 100vh; width: 100vw; overflow: hidden; }
</style>