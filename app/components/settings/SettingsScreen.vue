<!-- app/components/settings/SettingsScreen.vue -->
<!-- UI redesign — new dedicated screen. Purely presentation preferences
     (theme, sidebar, reduced motion) via uiPreferencesStore; no project
     or scene data is touched here. -->
<template>
  <div v-if="nav.activeScreen === 'settings'" class="settings-overlay">
    <PageHeader
      :icon="Settings"
      title="Settings"
      description="Appearance and interface preferences. Stored locally in this browser only."
      @back="nav.goToCanvas()"
    />

    <div class="settings-body">
      <section class="setting-group">
        <h2 class="group-title">Theme</h2>
        <div class="theme-options">
          <button
            v-for="mode in themeModes"
            :key="mode.value"
            class="theme-btn"
            :class="{ active: prefs.themeMode === mode.value }"
            @click="prefs.setThemeMode(mode.value)"
          >
            <component :is="mode.icon" :size="18" :stroke-width="2" />
            <span>{{ mode.label }}</span>
          </button>
        </div>
        <p class="group-hint">
          "System" follows your operating system's light/dark preference.
        </p>
      </section>

      <section class="setting-group">
        <h2 class="group-title">Interface</h2>

        <label class="toggle-row">
          <span>Collapse sidebar by default</span>
          <input
            type="checkbox"
            class="checkbox"
            :checked="prefs.sidebarCollapsed"
            @change="prefs.setSidebarCollapsed(($event.target as HTMLInputElement).checked)"
          />
        </label>

        <label class="toggle-row">
          <span>Reduce motion (disable animations)</span>
          <input
            type="checkbox"
            class="checkbox"
            :checked="prefs.reducedMotion"
            @change="prefs.setReducedMotion(($event.target as HTMLInputElement).checked)"
          />
        </label>
      </section>

      <section class="setting-group">
        <h2 class="group-title">Reset</h2>
        <button class="reset-btn" @click="prefs.resetPreferences()">
          <RotateCcw :size="14" :stroke-width="2" />
          <span>Reset preferences to defaults</span>
        </button>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Settings, Sun, Moon, Monitor, RotateCcw } from 'lucide-vue-next'
import { useNavigationStore } from '~/stores/navigation'
import { useUIPreferencesStore, type ThemeMode } from '~/stores/uiPreferences'
import PageHeader from '~/components/app-shell/PageHeader.vue'

const nav = useNavigationStore()
const prefs = useUIPreferencesStore()

const themeModes: Array<{ value: ThemeMode; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]
</script>

<style scoped>
.settings-overlay {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.settings-body {
  max-width: 560px; width: 100%; margin: 0 auto;
  padding: 20px 24px 32px; display: flex; flex-direction: column; gap: 24px;
}
.setting-group { display: flex; flex-direction: column; gap: 10px; }
.group-title {
  margin: 0; font-size: 11px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.5px;
}
.group-hint { margin: 0; font-size: 11.5px; color: var(--text-muted); }
.theme-options { display: flex; gap: 8px; }
.theme-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-secondary); font-size: 12px; padding: 14px 8px; cursor: pointer;
}
.theme-btn:hover { background: var(--hover); }
.theme-btn.active { border-color: var(--accent); background: var(--accent-soft); color: var(--text-primary); }
.toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 8px;
  padding: 12px 14px; font-size: 13px; color: var(--text-secondary); cursor: pointer;
}
.checkbox { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }
.reset-btn {
  display: flex; align-items: center; gap: 8px; align-self: flex-start;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-secondary); font-size: 12px; padding: 8px 14px; cursor: pointer;
}
.reset-btn:hover { border-color: var(--danger); color: var(--danger); }
</style>
