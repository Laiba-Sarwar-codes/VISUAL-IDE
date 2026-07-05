<!-- app/components/app-shell/PageHeader.vue -->
<!-- UI redesign — shared header used by every dedicated screen (AI
     Workflow, Monitoring, Collaboration, History, Version Control,
     Plugins, Export, Settings) so they look consistent instead of each
     reinventing its own header markup. Purely presentational — takes no
     store dependency itself, the Back button just emits an event. -->
<template>
  <div class="page-header">
    <div class="page-header-icon" aria-hidden="true">
      <component :is="icon" :size="20" :stroke-width="2" />
    </div>
    <div class="page-header-copy">
      <h1 class="page-header-title">{{ title }}</h1>
      <p v-if="description" class="page-header-desc">{{ description }}</p>
    </div>
    <slot name="actions" />
    <button type="button" class="back-btn" aria-label="Back to canvas" @click="$emit('back')">
      <ArrowLeft :size="15" :stroke-width="2" aria-hidden="true" />
      <span>Back to Canvas</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'

defineProps<{
  icon: Component
  title: string
  description?: string
}>()

defineEmits<{ back: [] }>()
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 28px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--accent-soft), transparent);
  flex-shrink: 0;
}

.page-header-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(124, 131, 255, 0.28);
}

.page-header-copy { flex: 1; min-width: 0; }
.page-header-title { margin: 0; font-size: 18px; font-weight: 700; color: var(--text-primary); }
.page-header-desc { margin: 4px 0 0; font-size: 12.5px; color: var(--text-secondary); max-width: 60ch; }

.back-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 550;
  white-space: nowrap;
  flex-shrink: 0;
  align-self: center;
}

.back-btn:hover { border-color: rgba(129, 140, 248, 0.4); color: var(--text-primary); }

@media (max-width: 640px) {
  .page-header { padding: 16px; flex-wrap: wrap; }
  .back-btn span { display: none; }
}
</style>
