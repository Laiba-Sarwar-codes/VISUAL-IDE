<!-- app/components/editor/PluginPanel.vue -->
<!-- Module 17 — shows installed plugins and their capabilities -->
<template>
  <div v-if="pluginUI.isOpen" class="plugin-overlay">
    <div class="plugin-panel">
      <PageHeader
        :icon="Puzzle"
        title="Plugins"
        description="Installed plugins and the commands, tools, exporters, and shortcuts they register."
        @back="pluginUI.close()"
      >
        <template #actions>
          <span class="plugin-count">{{ pluginStore.plugins.length }}</span>
        </template>
      </PageHeader>

      <div class="panel-body">
        <p v-if="pluginStore.plugins.length === 0" class="empty">
          No plugins installed.
        </p>

        <div
          v-for="plugin in pluginStore.plugins"
          :key="plugin.definition.id"
          class="plugin-card"
          :class="plugin.status"
        >
          <div class="plugin-top">
            <div class="plugin-info">
              <span class="plugin-name">{{ plugin.definition.name }}</span>
              <span class="plugin-version">v{{ plugin.definition.version }}</span>
            </div>
            <span class="plugin-status-badge" :class="plugin.status">
              {{ plugin.status }}
            </span>
          </div>

          <p class="plugin-desc">{{ plugin.definition.description }}</p>

          <!-- Registered capabilities -->
          <div class="plugin-caps">
            <span v-if="plugin.commands.length" class="cap">
              ⌨ {{ plugin.commands.length }} command{{ plugin.commands.length > 1 ? 's' : '' }}
            </span>
            <span v-if="plugin.tools.length" class="cap">
              🔧 {{ plugin.tools.length }} tool{{ plugin.tools.length > 1 ? 's' : '' }}
            </span>
            <span v-if="plugin.exporters.length" class="cap">
              📤 {{ plugin.exporters.length }} exporter{{ plugin.exporters.length > 1 ? 's' : '' }}
            </span>
            <span v-if="plugin.shortcuts.length" class="cap">
              ⚡ {{ plugin.shortcuts.length }} shortcut{{ plugin.shortcuts.length > 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Commands list -->
          <div v-if="plugin.commands.length" class="commands-list">
            <div
              v-for="cmd in plugin.commands"
              :key="cmd.id"
              class="command-row"
            >
              <span class="cmd-label">{{ cmd.label }}</span>
              <span v-if="cmd.shortcut" class="cmd-shortcut">{{ cmd.shortcut }}</span>
              <button class="run-btn" @click="pluginStore.executeCommand(cmd.id)">
                Run
              </button>
            </div>
          </div>

          <!-- Controls -->
          <div class="plugin-controls">
            <button
              v-if="plugin.status === 'inactive'"
              class="ctrl-btn activate"
              @click="pluginStore.activate(plugin.definition.id)"
            >Activate</button>
            <button
              v-if="plugin.status === 'active'"
              class="ctrl-btn deactivate"
              @click="pluginStore.deactivate(plugin.definition.id)"
            >Deactivate</button>
            <button
              class="ctrl-btn uninstall"
              @click="pluginStore.uninstall(plugin.definition.id)"
            >Uninstall</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Puzzle } from 'lucide-vue-next'
import { usePluginStore } from '~/stores/plugins'
import { usePluginUIStore } from '~/stores/pluginUI'
import PageHeader from '~/components/app-shell/PageHeader.vue'

const pluginStore = usePluginStore()
const pluginUI = usePluginUIStore()

defineExpose({ open: () => { pluginUI.open() } })
</script>

<style scoped>
.plugin-overlay {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.plugin-panel {
  display: flex; flex-direction: column; flex: 1; min-height: 0;
}
.plugin-count {
  background: var(--surface-2); color: var(--text-muted); font-size: 10px;
  padding: 2px 6px; border-radius: 8px;
}
.panel-body {
  max-width: 720px; width: 100%; margin: 0 auto;
  padding: 20px 24px 32px; display: flex; flex-direction: column; gap: 10px;
}
.empty { color: var(--text-muted); font-size: 13px; font-style: italic; text-align: center; padding: 20px; }
.plugin-card {
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 8px; padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.plugin-card.error { border-color: var(--danger); }
.plugin-top { display: flex; align-items: center; justify-content: space-between; }
.plugin-info { display: flex; align-items: baseline; gap: 6px; }
.plugin-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.plugin-version { font-size: 10px; color: var(--text-muted); }
.plugin-status-badge {
  font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;
}
.plugin-status-badge.active   { background: var(--success-soft); color: var(--success); }
.plugin-status-badge.inactive { background: var(--surface-2); color: var(--text-muted); }
.plugin-status-badge.error    { background: var(--danger-soft); color: var(--danger); }
.plugin-desc { font-size: 12px; color: var(--text-muted); margin: 0; }
.plugin-caps { display: flex; flex-wrap: wrap; gap: 6px; }
.cap { font-size: 10px; color: var(--text-secondary); background: var(--surface-2); padding: 2px 6px; border-radius: 4px; }
.commands-list { display: flex; flex-direction: column; gap: 4px; }
.command-row {
  display: flex; align-items: center; gap: 8px; padding: 5px 8px;
  background: var(--surface-2); border-radius: 5px;
}
.cmd-label { flex: 1; font-size: 12px; color: var(--text-secondary); }
.cmd-shortcut { font-size: 10px; color: var(--text-muted); font-family: monospace; }
.run-btn {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 4px;
  color: var(--text-secondary); font-size: 11px; cursor: pointer; padding: 2px 8px;
}
.run-btn:hover { background: var(--accent); color: #ffffff; border-color: var(--accent); }
.plugin-controls { display: flex; gap: 6px; }
.ctrl-btn {
  font-size: 11px; padding: 4px 10px; border-radius: 5px; cursor: pointer; border: none;
}
.ctrl-btn.activate   { background: var(--accent-soft); color: var(--accent); }
.ctrl-btn.activate:hover { background: var(--accent); color: #ffffff; }
.ctrl-btn.deactivate { background: var(--surface-2); color: var(--text-muted); }
.ctrl-btn.deactivate:hover { background: var(--hover); color: var(--text-secondary); }
.ctrl-btn.uninstall  { background: var(--danger-soft); color: var(--danger); }
.ctrl-btn.uninstall:hover { filter: brightness(0.9); color: #ffffff; }
</style>