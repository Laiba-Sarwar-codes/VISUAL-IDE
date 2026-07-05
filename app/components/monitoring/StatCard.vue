<!-- app/components/monitoring/StatCard.vue -->
<!-- Module 21 — single metric display card -->
<template>
  <div class="stat-card">
    <div class="stat-label">{{ label }}</div>
    <div class="stat-value" :style="{ color: valueColor }">
      {{ value }}
    </div>
    <div v-if="sub" class="stat-sub">{{ sub }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  sub?: string
  valueColor?: string
}>()
</script>

<style scoped>
.stat-card {
  background: var(--surface-0);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 80px;
}
.stat-label {
  font-size: 9px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-family: monospace;
}
.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: monospace;
  line-height: 1.2;
}
.stat-sub {
  font-size: 9px;
  color: var(--text-muted);
  font-family: monospace;
}
</style>