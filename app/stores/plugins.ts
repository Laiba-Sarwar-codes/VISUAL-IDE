// app/stores/plugins.ts
// Module 17 — reactive plugin state for UI

import { defineStore } from 'pinia'
import { pluginRegistry } from '~~/src/plugins/PluginRegistry'
import type { PluginDefinition, PluginRecord } from '~~/src/plugins/types'

interface PluginStoreState {
  plugins: PluginRecord[]
}

export const usePluginStore = defineStore('plugins', {
  state: (): PluginStoreState => ({
    plugins: [],
  }),

  getters: {
    activePlugins: (state) => state.plugins.filter(p => p.status === 'active'),
    commandCount: (state) => state.plugins.reduce((n, p) => n + p.commands.length, 0),
    toolCount: (state) => state.plugins.reduce((n, p) => n + p.tools.length, 0),
  },

  actions: {
    /**
     * Why: syncs the Pinia state from the plain PluginRegistry singleton.
     * Called after every install/activate/deactivate so the UI always
     * reflects the current registry state reactively.
     */
    sync(): void {
      this.plugins = pluginRegistry.getAllPlugins()
    },

    async install(definition: PluginDefinition): Promise<void> {
      await pluginRegistry.install(definition)
      this.sync()
    },

    async activate(id: string): Promise<void> {
      await pluginRegistry.activate(id)
      this.sync()
    },

    async deactivate(id: string): Promise<void> {
      await pluginRegistry.deactivate(id)
      this.sync()
    },

    async uninstall(id: string): Promise<void> {
      await pluginRegistry.uninstall(id)
      this.sync()
    },

    executeCommand(commandId: string): void {
      pluginRegistry.executeCommand(commandId)
    },
  },
})