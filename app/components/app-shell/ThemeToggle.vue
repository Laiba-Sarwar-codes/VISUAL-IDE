<!-- app/components/app-shell/ThemeToggle.vue -->
<!-- UI redesign — cycles Light -> Dark -> System, calling the same
     uiPreferences store the Settings screen's theme radios use. -->
<template>
  <button
    type="button"
    class="theme-toggle"
    :title="`Theme: ${label} (click to change)`"
    :aria-label="`Change theme, currently ${label}`"
    @click="cycle"
  >
    <Sun v-if="prefs.themeMode === 'light'" :size="16" :stroke-width="2" aria-hidden="true" />
    <Moon v-else-if="prefs.themeMode === 'dark'" :size="16" :stroke-width="2" aria-hidden="true" />
    <Monitor v-else :size="16" :stroke-width="2" aria-hidden="true" />
    <span v-if="!collapsed" class="theme-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Sun, Moon, Monitor } from 'lucide-vue-next'
import { useUIPreferencesStore } from '~/stores/uiPreferences'

defineProps<{ collapsed?: boolean }>()

const prefs = useUIPreferencesStore()

const label = computed(() => {
  switch (prefs.themeMode) {
    case 'light': return 'Light'
    case 'dark': return 'Dark'
    default: return 'System'
  }
})

function cycle(): void {
  const order = ['light', 'dark', 'system'] as const
  const next = order[(order.indexOf(prefs.themeMode) + 1) % order.length]!
  prefs.setThemeMode(next)
}
</script>

<style scoped>
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: pointer;
}

.theme-toggle:hover {
  border-color: rgba(129, 140, 248, 0.35);
  color: var(--text-primary);
}

.theme-label {
  font-size: 11.5px;
  font-weight: 550;
}
</style>
