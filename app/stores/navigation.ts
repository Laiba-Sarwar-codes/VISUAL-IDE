// app/stores/navigation.ts
// UI redesign — single source of truth for "which dedicated screen is
// showing". Deliberately has NO independent `activeScreen` state of its
// own: it's a getter DERIVED from each feature's existing open/close
// boolean (ai.isOpen, mon.isOpen, vc.isPanelOpen, exportStore.isDialogOpen,
// plus two new tiny stores for collaboration/plugins that previously only
// had a local component ref). This means the sidebar's "active" highlight
// can never go stale even if a panel is closed via its own internal
// close button rather than through this store — there is only ever one
// real boolean per screen, not a second parallel copy to keep in sync.
//
// Every existing store's own isOpen/openDialog/closePanel API keeps
// working exactly as before for any code that still calls it directly —
// this store only adds a convenience layer on top.

import { defineStore } from 'pinia'
import { useAIWorkflowStore } from './aiWorkflow'
import { useMonitoringStore } from './monitoring'
import { useVersionControlStore } from './versionControl'
import { useExportStore } from './export'
import { useCollaborationUIStore } from './collaborationUI'
import { usePluginUIStore } from './pluginUI'

export type ScreenId =
  | 'canvas'
  | 'ai-workflow'
  | 'monitoring'
  | 'collaboration'
  | 'history'
  | 'version-control'
  | 'plugins'
  | 'export'
  | 'settings'

interface NavigationState {
  // History/Settings have no pre-existing store of their own — these two
  // booleans are the only genuinely-new open/close state in this file.
  historyOpen: boolean
  settingsOpen: boolean
}

export const useNavigationStore = defineStore('navigation', {
  state: (): NavigationState => ({
    historyOpen: false,
    settingsOpen: false,
  }),

  getters: {
    activeScreen(state): ScreenId {
      if (useAIWorkflowStore().isOpen) return 'ai-workflow'
      if (useMonitoringStore().isOpen) return 'monitoring'
      if (useVersionControlStore().isPanelOpen) return 'version-control'
      if (useExportStore().isDialogOpen) return 'export'
      if (useCollaborationUIStore().isOpen) return 'collaboration'
      if (usePluginUIStore().isOpen) return 'plugins'
      if (state.historyOpen) return 'history'
      if (state.settingsOpen) return 'settings'
      return 'canvas'
    },
  },

  actions: {
    /** Closes whichever screen is currently open (idempotent — safe even if nothing is open). */
    closeAll(): void {
      useAIWorkflowStore().close()
      useMonitoringStore().close()
      useVersionControlStore().closePanel()
      useExportStore().closeDialog()
      useCollaborationUIStore().close()
      usePluginUIStore().close()
      this.historyOpen = false
      this.settingsOpen = false
    },

    /** Opens exactly one screen, closing any other that might be open. */
    openScreen(id: ScreenId): void {
      this.closeAll()
      switch (id) {
        case 'ai-workflow': useAIWorkflowStore().open(); break
        case 'monitoring': useMonitoringStore().open(); break
        case 'version-control': useVersionControlStore().openPanel(); break
        case 'export': useExportStore().openDialog(); break
        case 'collaboration': useCollaborationUIStore().open(); break
        case 'plugins': usePluginUIStore().open(); break
        case 'history': this.historyOpen = true; break
        case 'settings': this.settingsOpen = true; break
        case 'canvas': break
      }
    },

    goToCanvas(): void {
      this.closeAll()
    },
  },
})
