<!-- app/components/command-palette/CommandPalette.vue -->
<!-- Module 18 — command palette UI component -->
<template>
  <Teleport to="body">
    <div v-if="palette.isOpen" class="palette-overlay" @click.self="palette.close()">
      <div class="palette-container">

        <div class="palette-input-wrap">
          <span class="palette-icon">⌘</span>
          <input
            ref="inputRef"
            class="palette-input"
            placeholder="Type a command…"
            :value="palette.query"
            @input="palette.setQuery(($event.target as HTMLInputElement).value)"
            @keydown.escape="palette.close()"
            @keydown.up.prevent="palette.moveUp()"
            @keydown.down.prevent="palette.moveDown()"
            @keydown.enter.prevent="palette.executeActive()"
            @keydown.tab.prevent="handleTab"
          />
          <span class="palette-hint">ESC to close</span>
        </div>

        <div class="palette-results">
          <div v-if="!palette.hasResults" class="palette-empty">
            No commands found for "{{ palette.query }}"
          </div>

          <div
            v-for="(result, index) in palette.results"
            :key="result.command.id"
            class="palette-item"
            :class="{ active: index === palette.activeIndex }"
            :ref="el => setItemRef(el, index)"
            @click="selectAndExecute(index)"
            @mousemove="palette.activeIndex = index"
          >
            <span class="item-icon">{{ result.command.icon ?? '▸' }}</span>
            <div class="item-body">
              <span class="item-label">{{ result.command.label }}</span>
              <span class="item-category">{{ result.command.category }}</span>
            </div>
            <span v-if="result.command.shortcut" class="item-shortcut">
              {{ result.command.shortcut }}
            </span>
          </div>
        </div>

        <div class="palette-footer">
          <span>↑↓ navigate</span>
          <span>↵ execute</span>
          <span>{{ palette.results.length }} command{{ palette.results.length !== 1 ? 's' : '' }}</span>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useCommandPaletteStore } from '~/stores/commandPalette'

const palette = useCommandPaletteStore()
const inputRef = ref<HTMLInputElement | null>(null)
const itemRefs = ref<(Element | null)[]>([])

function setItemRef(el: unknown, index: number): void {
  itemRefs.value[index] = el instanceof Element ? el : null
}

function selectAndExecute(index: number): void {
  palette.activeIndex = index
  palette.executeActive()
}

function handleTab(e: KeyboardEvent): void {
  e.shiftKey ? palette.moveUp() : palette.moveDown()
}

// Focus input when palette opens
watch(() => palette.isOpen, async (open) => {
  if (open) {
    await nextTick()
    inputRef.value?.focus()
  }
})

// Scroll active item into view
watch(() => palette.activeIndex, async (index) => {
  await nextTick()
  itemRefs.value[index]?.scrollIntoView({ block: 'nearest' })
})
</script>

<style scoped>
.palette-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-command-palette);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}
.palette-container {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 580px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-float);
}
.palette-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.palette-icon { color: var(--text-muted); font-size: 14px; }
.palette-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text-primary); font-size: 15px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.palette-input::placeholder { color: var(--text-muted); }
.palette-hint { color: var(--text-muted); font-size: 11px; white-space: nowrap; font-family: monospace; }
.palette-results { flex: 1; overflow-y: auto; padding: 4px 0; }
.palette-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }
.palette-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 16px; cursor: pointer;
}
.palette-item:hover { background: var(--hover); }
.palette-item.active { background: var(--accent-soft); }
.item-icon { font-size: 13px; width: 18px; text-align: center; flex-shrink: 0; color: var(--text-secondary); }
.item-body { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.item-label { font-size: 13px; color: var(--text-primary); }
.item-category { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
.item-shortcut {
  font-size: 11px; color: var(--text-muted); font-family: monospace;
  background: var(--surface-0); padding: 2px 6px; border-radius: 4px;
  border: 1px solid var(--border); white-space: nowrap;
}
.palette-footer {
  display: flex; gap: 16px; padding: 8px 16px;
  border-top: 1px solid var(--border); font-size: 10px;
  color: var(--text-muted); font-family: monospace; flex-shrink: 0;
  justify-content: flex-end;
}
</style>