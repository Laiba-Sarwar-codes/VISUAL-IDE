// app/stores/pluginUI.ts
// UI redesign — replaces PluginPanel.vue's previous local `ref(false)`
// open-state with shared Pinia state, so a component outside
// StatusBar.vue (the new sidebar) can open it too. Purely presentation
// state — no plugin execution/registry behavior lives here.

import { defineStore } from 'pinia'

interface PluginUIState {
  isOpen: boolean
}

export const usePluginUIStore = defineStore('pluginUI', {
  state: (): PluginUIState => ({ isOpen: false }),
  actions: {
    open(): void { this.isOpen = true },
    close(): void { this.isOpen = false },
    toggle(): void { this.isOpen = !this.isOpen },
  },
})
