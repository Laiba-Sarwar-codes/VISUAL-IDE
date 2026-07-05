// app/stores/collaborationUI.ts
// UI redesign — replaces CollaborationPanel.vue's previous local
// `ref(false)` open-state with shared Pinia state, so a component outside
// StatusBar.vue (the new sidebar) can open it too. Purely presentation
// state — no collaboration/CRDT/WebRTC behavior lives here.

import { defineStore } from 'pinia'

interface CollaborationUIState {
  isOpen: boolean
}

export const useCollaborationUIStore = defineStore('collaborationUI', {
  state: (): CollaborationUIState => ({ isOpen: false }),
  actions: {
    open(): void { this.isOpen = true },
    close(): void { this.isOpen = false },
    toggle(): void { this.isOpen = !this.isOpen },
  },
})
