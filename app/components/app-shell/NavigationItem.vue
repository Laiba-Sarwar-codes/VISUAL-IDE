<!-- app/components/app-shell/NavigationItem.vue -->
<!-- UI redesign — one sidebar entry: real icon + visible label + active/
     hover/focus-visible states + accessible name + optional tooltip when
     the sidebar is collapsed (title attribute) + optional badge. -->
<template>
  <button
    type="button"
    class="nav-item"
    :class="{ active }"
    :aria-current="active ? 'page' : undefined"
    :aria-label="label"
    :title="collapsed ? label : undefined"
    @click="$emit('activate')"
  >
    <span class="nav-icon" aria-hidden="true">
      <component :is="icon" :size="18" :stroke-width="2" />
    </span>
    <span v-if="!collapsed" class="nav-label">{{ label }}</span>
    <span v-if="!collapsed && badge !== undefined" class="nav-badge">{{ badge }}</span>
    <span v-else-if="collapsed && badge !== undefined" class="nav-badge nav-badge--dot" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  label: string
  active: boolean
  collapsed?: boolean
  badge?: string | number
}>()

defineEmits<{ activate: [] }>()
</script>

<style scoped>
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  height: 38px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.nav-item:hover {
  background: var(--hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-soft);
  border-color: rgba(129, 140, 248, 0.35);
  color: var(--text-primary);
}

.nav-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: inherit;
}

.nav-item.active .nav-icon { color: var(--accent); }

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
  font-weight: 550;
}

.nav-badge {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-secondary);
  font: 600 10px/1 ui-monospace, monospace;
}

.nav-badge--dot {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 7px;
  width: 7px;
  height: 7px;
  padding: 0;
  background: var(--accent);
}
</style>
