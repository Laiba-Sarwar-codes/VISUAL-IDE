<!-- app/components/app-shell/AppSidebar.vue -->
<!-- UI redesign — persistent application navigation rail. Narrow icon
     rail (least disruptive to the existing EditorShell toolbar/panel grid,
     per the audit) rather than replacing the editor's own toolbar/left
     panel. Collapsible, and becomes an off-canvas drawer below ~860px.
     Every item reuses existing stores/services — no new feature logic. -->
<template>
  <Teleport to="body" :disabled="!isMobileOpen">
    <div v-if="isMobileOpen" class="mobile-scrim" @click="isMobileOpen = false" />
  </Teleport>

  <button
    type="button"
    class="mobile-hamburger"
    aria-label="Open navigation menu"
    @click="isMobileOpen = true"
  >
    <Menu :size="18" :stroke-width="2" aria-hidden="true" />
  </button>

  <nav
    class="app-sidebar"
    :class="{ collapsed: prefs.sidebarCollapsed, 'mobile-open': isMobileOpen }"
    aria-label="Application navigation"
  >
    <div class="sidebar-header">
      <div class="brand-mark" aria-hidden="true">
        <span /><span /><span />
      </div>
      <span v-if="!prefs.sidebarCollapsed" class="brand-name">Collab IDE</span>
      <button
        type="button"
        class="mobile-close"
        aria-label="Close navigation menu"
        @click="isMobileOpen = false"
      >
        <X :size="16" :stroke-width="2" aria-hidden="true" />
      </button>
    </div>

    <div class="nav-list" role="list">
      <NavigationItem
        :icon="LayoutDashboard"
        label="Canvas"
        :active="nav.activeScreen === 'canvas'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('canvas')"
      />
      <NavigationItem
        :icon="LayersIcon"
        label="Layers"
        :active="editor.leftPanelOpen && nav.activeScreen === 'canvas'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="openLayers"
      />
      <NavigationItem
        :icon="FolderTree"
        label="Project Explorer"
        :active="project.isExplorerOpen"
        :collapsed="prefs.sidebarCollapsed"
        @activate="openProjectExplorer"
      />
      <NavigationItem
        :icon="Images"
        label="Assets"
        :active="editor.leftPanelOpen && nav.activeScreen === 'canvas'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="openLayers"
      />

      <div class="nav-divider" role="separator" />

      <NavigationItem
        :icon="WandSparkles"
        label="AI Workflow"
        :active="nav.activeScreen === 'ai-workflow'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('ai-workflow')"
      />
      <NavigationItem
        :icon="Users"
        label="Collaboration"
        :active="nav.activeScreen === 'collaboration'"
        :collapsed="prefs.sidebarCollapsed"
        :badge="inRoom ? '●' : undefined"
        @activate="go('collaboration')"
      />
      <NavigationItem
        :icon="HistoryIcon"
        label="History"
        :active="nav.activeScreen === 'history'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('history')"
      />
      <NavigationItem
        :icon="GitBranch"
        label="Version Control"
        :active="nav.activeScreen === 'version-control'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('version-control')"
      />
      <NavigationItem
        :icon="Blocks"
        label="Plugins"
        :active="nav.activeScreen === 'plugins'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('plugins')"
      />
      <NavigationItem
        :icon="Activity"
        label="Monitoring"
        :active="nav.activeScreen === 'monitoring'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('monitoring')"
      />
      <NavigationItem
        :icon="Download"
        label="Export"
        :active="nav.activeScreen === 'export'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('export')"
      />

      <div class="nav-divider" role="separator" />

      <NavigationItem
        :icon="Search"
        label="Command Palette"
        :active="false"
        :collapsed="prefs.sidebarCollapsed"
        @activate="palette.toggle()"
      />
      <NavigationItem
        :icon="SettingsIcon"
        label="Settings"
        :active="nav.activeScreen === 'settings'"
        :collapsed="prefs.sidebarCollapsed"
        @activate="go('settings')"
      />
    </div>

    <div class="sidebar-footer">
      <div class="mini-status" :title="offlineStore.statusLabel">
        <span class="mini-dot" :class="offlineStore.networkStatus" aria-hidden="true" />
        <span v-if="!prefs.sidebarCollapsed" class="mini-text">{{ saveLabel }}</span>
      </div>
      <ThemeToggle :collapsed="prefs.sidebarCollapsed" />
      <button
        type="button"
        class="collapse-btn"
        :aria-label="prefs.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        @click="prefs.toggleSidebar()"
      >
        <PanelLeftClose v-if="!prefs.sidebarCollapsed" :size="16" :stroke-width="2" aria-hidden="true" />
        <PanelLeftOpen v-else :size="16" :stroke-width="2" aria-hidden="true" />
        <span v-if="!prefs.sidebarCollapsed">Collapse</span>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  LayoutDashboard, Layers as LayersIcon, FolderTree, Images, WandSparkles, Users,
  History as HistoryIcon, GitBranch, Blocks, Activity, Download, Search,
  Settings as SettingsIcon, Menu, X, PanelLeftClose, PanelLeftOpen,
} from 'lucide-vue-next'
import { useNavigationStore, type ScreenId } from '~/stores/navigation'
import { useUIPreferencesStore } from '~/stores/uiPreferences'
import { useEditorStore } from '~/stores/editor'
import { useProjectStore } from '~/stores/project'
import { useOfflineStore } from '~/stores/offline'
import { useCommandPaletteStore } from '~/stores/commandPalette'
import { webRTCManager } from '~~/src/collaboration/webrtc/WebRTCManager'
import NavigationItem from './NavigationItem.vue'
import ThemeToggle from './ThemeToggle.vue'

const nav = useNavigationStore()
const prefs = useUIPreferencesStore()
const editor = useEditorStore()
const project = useProjectStore()
const offlineStore = useOfflineStore()
const palette = useCommandPaletteStore()

const isMobileOpen = ref(false)
const inRoom = computed(() => webRTCManager.isInRoom)

function go(id: ScreenId): void {
  nav.openScreen(id)
  isMobileOpen.value = false
}

function openLayers(): void {
  nav.goToCanvas()
  if (!editor.leftPanelOpen) editor.toggleLeftPanel()
  isMobileOpen.value = false
}

function openProjectExplorer(): void {
  project.isExplorerOpen = true
  isMobileOpen.value = false
}

const saveLabel = computed(() => {
  switch (project.saveStatus) {
    case 'saving': return 'Saving…'
    case 'saved': return 'Saved'
    case 'unsaved': return 'Unsaved'
    case 'error': return 'Save failed'
    default: return ''
  }
})
</script>

<style scoped>
.app-sidebar {
  display: flex;
  flex-direction: column;
  width: var(--nav-rail-width);
  min-width: var(--nav-rail-width);
  height: 100%;
  padding: 10px 8px;
  gap: 8px;
  background: var(--surface-1);
  border-right: 1px solid var(--border);
  transition: width 160ms ease, min-width 160ms ease;
}

.app-sidebar.collapsed {
  width: var(--nav-rail-collapsed-width);
  min-width: var(--nav-rail-collapsed-width);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 36px;
  padding: 0 3px;
  flex-shrink: 0;
}

.brand-mark {
  position: relative;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 8px;
  background: linear-gradient(145deg, #8b8fff, #5c61e8);
  box-shadow: 0 6px 14px rgba(99, 102, 241, 0.28);
  overflow: hidden;
}

.brand-mark span {
  position: absolute;
  width: 7px;
  height: 7px;
  border: 2px solid rgba(255, 255, 255, 0.94);
  border-radius: 2px;
}
.brand-mark span:nth-child(1) { left: 5px; top: 5px; }
.brand-mark span:nth-child(2) { right: 5px; top: 5px; }
.brand-mark span:nth-child(3) { left: 9px; bottom: 4px; }

.brand-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}

.mobile-close { display: none; }

.nav-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-divider {
  height: 1px;
  margin: 6px 3px;
  background: var(--border-subtle);
  flex-shrink: 0;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
  padding-top: 6px;
  border-top: 1px solid var(--border-subtle);
}

.mini-status {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 24px;
  padding: 0 6px;
}

.mini-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; }
.mini-dot.online { background: var(--success); }
.mini-dot.offline { background: var(--danger); }
.mini-dot.reconnecting { background: var(--warning); }
.mini-text { font-size: 10.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.collapse-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
}

.collapse-btn:hover { background: var(--hover); color: var(--text-primary); }

.mobile-hamburger {
  display: none;
  position: fixed;
  z-index: var(--z-panel);
  top: 10px;
  left: 10px;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-primary);
  cursor: pointer;
}

.mobile-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-panel);
  background: rgba(0, 0, 0, 0.5);
}

@media (max-width: 860px) {
  .mobile-hamburger { display: flex; }

  .app-sidebar {
    position: fixed;
    z-index: calc(var(--z-panel) + 1);
    top: 0;
    left: 0;
    bottom: 0;
    width: min(260px, 82vw);
    min-width: 0;
    transform: translateX(-100%);
    box-shadow: var(--shadow-panel);
    transition: transform 180ms ease;
  }

  .app-sidebar.collapsed { width: min(260px, 82vw); }

  .app-sidebar.mobile-open { transform: translateX(0); }

  .mobile-close {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-sidebar { transition: none; }
}
</style>
