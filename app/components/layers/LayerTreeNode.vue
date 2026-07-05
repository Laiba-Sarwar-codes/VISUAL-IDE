<!-- app/components/layers/LayerTreeNode.vue -->
<!-- Layer Management — one recursive layer-tree row: expand arrow, type
     icon, name (rename on double-click/Enter), visibility/lock, and (when
     selected) opacity + blend-mode controls, mirroring the pre-existing
     flat panel's expand-on-select convention. Native HTML5 drag & drop
     (no DnD library) with before/after/inside drop zones and auto-expand. -->
<template>
  <li
    class="layer-node"
    :class="{ 'is-folder-or-group': node.kind !== 'leaf' }"
  >
    <div
      class="layer-row"
      :class="{
        selected: selection.isSelected(node.id),
        primary: selection.selectedId === node.id,
        locked: node.locked,
        hidden: !node.visible,
        'drop-before': dropZone === 'before',
        'drop-after': dropZone === 'after',
        'drop-inside': dropZone === 'inside',
      }"
      :style="{ paddingLeft: `${7 + depth * 16}px` }"
      tabindex="0"
      role="treeitem"
      :aria-selected="selection.isSelected(node.id)"
      :aria-expanded="node.kind !== 'leaf' ? node.expanded : undefined"
      draggable="true"
      @click="handleClick"
      @dblclick.stop="startRename"
      @keydown="onRowKeyDown"
      @dragstart="onDragStart"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <button
        v-if="node.kind !== 'leaf'"
        type="button"
        class="expand-btn"
        :aria-label="node.expanded ? 'Collapse' : 'Expand'"
        @click.stop="$emit('toggle-expand', node)"
      >
        {{ node.expanded ? '▾' : '▸' }}
      </button>
      <span v-else class="expand-spacer" aria-hidden="true" />

      <span class="layer-icon" aria-hidden="true">{{ iconFor(node) }}</span>

      <input
        v-if="isRenaming"
        ref="renameInputRef"
        v-model="renameValue"
        class="rename-input"
        @click.stop
        @keydown.enter="commitRename"
        @keydown.escape="cancelRename"
        @blur="commitRename"
      />
      <span v-else class="layer-name" :title="node.name">{{ node.name }}</span>

      <button
        type="button"
        class="icon-btn"
        :title="node.visible ? 'Hide layer' : 'Show layer'"
        :aria-label="node.visible ? `Hide ${node.name}` : `Show ${node.name}`"
        @click.stop="scene.toggleVisibility(node.id)"
      >
        {{ node.visible ? '◉' : '○' }}
      </button>

      <button
        type="button"
        class="icon-btn"
        :class="{ emphasized: node.locked }"
        :title="node.locked ? 'Unlock layer' : 'Lock layer'"
        :aria-label="node.locked ? `Unlock ${node.name}` : `Lock ${node.name}`"
        @click.stop="scene.toggleLocked(node.id)"
      >
        {{ node.locked ? '●' : '◌' }}
      </button>

      <button
        type="button"
        class="icon-btn"
        title="Delete"
        :aria-label="`Delete ${node.name}`"
        @click.stop="$emit('delete-node', node)"
      >
        🗑
      </button>
    </div>

    <div v-if="selection.selectedId === node.id" class="layer-details" @click.stop>
      <div class="layer-opacity">
        <span class="opacity-label">Opacity</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="node.opacity"
          class="opacity-slider"
          :aria-label="`${node.name} opacity`"
          @input="handleOpacity"
        />
        <span class="opacity-value">{{ Math.round(node.opacity * 100) }}%</span>
      </div>

      <div class="layer-blendmode">
        <span class="opacity-label">Blend</span>
        <select class="blend-select" :value="node.blendMode ?? 'normal'" @change="handleBlendMode" @click.stop>
          <option v-for="mode in BLEND_MODES" :key="mode" :value="mode">{{ mode }}</option>
        </select>
      </div>

      <div v-if="node.kind === 'leaf'" class="layer-controls">
        <button type="button" class="ctrl-btn" title="Bring to front" aria-label="Bring to front" @click.stop="scene.bringToFront(node.id)">⤒</button>
        <button type="button" class="ctrl-btn" title="Bring forward" aria-label="Bring forward" @click.stop="scene.bringForward(node.id)">↑</button>
        <button type="button" class="ctrl-btn" title="Send backward" aria-label="Send backward" @click.stop="scene.sendBackward(node.id)">↓</button>
        <button type="button" class="ctrl-btn" title="Send to back" aria-label="Send to back" @click.stop="scene.sendToBack(node.id)">⤓</button>
      </div>
    </div>

    <ul v-if="node.kind !== 'leaf' && node.expanded && displayChildren.length > 0" class="layer-children" role="group">
      <LayerTreeNode
        v-for="child in displayChildren"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        @select="(...args) => $emit('select', ...args)"
        @toggle-expand="(...args) => $emit('toggle-expand', ...args)"
        @rename="(...args) => $emit('rename', ...args)"
        @delete-node="(...args) => $emit('delete-node', ...args)"
        @drop-node="(...args) => $emit('drop-node', ...args)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'
import { BLEND_MODES } from '~~/src/layers/types'
import type { LayerTreeNode as LayerTreeNodeModel } from '~~/src/layers/types'
import type { DropPosition } from '~~/src/layers/LayerDragDropService'

const props = defineProps<{
  node: LayerTreeNodeModel
  depth: number
}>()

const emit = defineEmits<{
  select: [node: LayerTreeNodeModel, event: MouseEvent]
  'toggle-expand': [node: LayerTreeNodeModel]
  rename: [node: LayerTreeNodeModel, name: string]
  'delete-node': [node: LayerTreeNodeModel]
  'drop-node': [draggedId: string, targetId: string, position: DropPosition]
}>()

const scene = useSceneStore()
const selection = useSelectionStore()

// Panel displays top-of-stack first at every level (matches the
// pre-existing flat panel's reversed convention).
const displayChildren = computed(() => [...props.node.children].reverse())

function iconFor(node: LayerTreeNodeModel): string {
  if (node.kind === 'folder') return '📁'
  if (node.kind === 'group') return '⧉'
  switch (node.objectType) {
    case 'rectangle': return '▭'
    case 'ellipse': return '○'
    case 'text': return 'T'
    case 'image': return '▧'
    default: return '□'
  }
}

function handleClick(e: MouseEvent): void {
  emit('select', props.node, e)
}

// ── Rename ─────────────────────────────────────────────────────────────
const isRenaming = ref(false)
const renameValue = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

async function startRename(): Promise<void> {
  isRenaming.value = true
  renameValue.value = props.node.name
  await nextTick()
  renameInputRef.value?.focus()
  renameInputRef.value?.select()
}

function commitRename(): void {
  if (!isRenaming.value) return
  isRenaming.value = false
  const trimmed = renameValue.value.trim()
  if (trimmed && trimmed !== props.node.name) emit('rename', props.node, trimmed)
}

function cancelRename(): void {
  isRenaming.value = false
}

// ── Opacity / blend mode ────────────────────────────────────────────────
function handleOpacity(e: Event): void {
  scene.setOpacity(props.node.id, parseFloat((e.target as HTMLInputElement).value))
}

function handleBlendMode(e: Event): void {
  scene.setBlendMode(props.node.id, (e.target as HTMLSelectElement).value as LayerTreeNodeModel['blendMode'] & string)
}

// ── Keyboard accessibility ───────────────────────────────────────────────
function onRowKeyDown(e: KeyboardEvent): void {
  if (isRenaming.value) return
  if (e.key === 'Enter') {
    if (selection.selectedId === props.node.id) startRename()
    else emit('select', props.node, e as unknown as MouseEvent)
  } else if (e.key === ' ') {
    e.preventDefault()
    scene.toggleVisibility(props.node.id)
  } else if (e.key === 'ArrowRight' && props.node.kind !== 'leaf' && !props.node.expanded) {
    emit('toggle-expand', props.node)
  } else if (e.key === 'ArrowLeft' && props.node.kind !== 'leaf' && props.node.expanded) {
    emit('toggle-expand', props.node)
  }
}

// ── Drag and drop ────────────────────────────────────────────────────────
const dropZone = ref<DropPosition | null>(null)
let autoExpandTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutoExpand(): void {
  if (autoExpandTimer || props.node.kind === 'leaf' || props.node.expanded) return
  autoExpandTimer = setTimeout(() => {
    emit('toggle-expand', props.node)
    autoExpandTimer = null
  }, 600)
}

function cancelAutoExpand(): void {
  if (autoExpandTimer) {
    clearTimeout(autoExpandTimer)
    autoExpandTimer = null
  }
}

function onDragStart(e: DragEvent): void {
  e.dataTransfer?.setData('text/plain', props.node.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const relY = e.clientY - rect.top
  const canAcceptInside = props.node.kind !== 'leaf'

  if (canAcceptInside && relY > rect.height * 0.25 && relY < rect.height * 0.75) {
    dropZone.value = 'inside'
    scheduleAutoExpand()
  } else {
    dropZone.value = relY <= rect.height / 2 ? 'before' : 'after'
    cancelAutoExpand()
  }
}

function onDragLeave(): void {
  dropZone.value = null
  cancelAutoExpand()
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  const draggedId = e.dataTransfer?.getData('text/plain')
  const zone = dropZone.value
  dropZone.value = null
  cancelAutoExpand()
  if (!draggedId || !zone) return
  emit('drop-node', draggedId, props.node.id, zone)
}
</script>

<style scoped>
.layer-node { list-style: none; }
.layer-children { list-style: none; margin: 0; padding: 0; }

.layer-row {
  min-height: 34px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 7px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 100ms ease, border-color 100ms ease;
}
.layer-row:hover { background: var(--hover); }
.layer-row.selected { border-color: rgba(129,140,248,0.3); background: var(--selected); }
.layer-row.primary { border-color: rgba(129,140,248,0.55); }
.layer-row.hidden { opacity: 0.46; }
.layer-row.locked .layer-name { color: #8f99a9; }
.layer-row.drop-before { box-shadow: inset 0 2px 0 0 var(--accent); }
.layer-row.drop-after { box-shadow: inset 0 -2px 0 0 var(--accent); }
.layer-row.drop-inside { background: var(--accent-soft); border-color: var(--accent); }

.expand-btn {
  width: 16px; height: 16px; flex: 0 0 16px;
  display: grid; place-items: center;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; font-size: 9px; padding: 0;
}
.expand-spacer { width: 16px; flex: 0 0 16px; }

.layer-icon { width: 22px; height: 22px; display: grid; place-items: center; flex: 0 0 22px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--surface-0); color: var(--text-secondary); font-size: 10px; }
.layer-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 550; }
.rename-input { flex: 1; min-width: 0; height: 22px; padding: 0 5px; border: 1px solid var(--accent); border-radius: 5px; background: var(--surface-0); color: var(--text-primary); font-size: 11px; }

.icon-btn { width: 23px; height: 23px; display: grid; place-items: center; padding: 0; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 9px; opacity: 0; transition: opacity 100ms ease, background 100ms ease, color 100ms ease; }
.layer-row:hover .icon-btn,
.layer-row.selected .icon-btn,
.icon-btn.emphasized { opacity: 1; }
.icon-btn:hover { border-color: var(--border); background: var(--surface-3); color: var(--text-primary); }
.icon-btn.emphasized { color: var(--warning); }

.layer-details { margin: 0 7px 7px; padding: 8px; border: 1px solid rgba(129,140,248,0.16); border-radius: 7px; background: rgba(8,12,19,0.42); }
.layer-opacity { display: grid; grid-template-columns: auto minmax(0,1fr) 34px; align-items: center; gap: 7px; }
.layer-blendmode { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 7px; margin-top: 7px; }
.opacity-label { color: var(--text-muted); font-size: 9px; }
.opacity-slider { width: 100%; height: 4px; accent-color: var(--accent); }
.opacity-value { color: var(--text-secondary); font: 600 9px/1 ui-monospace, monospace; text-align: right; }
.blend-select { height: 24px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); color: var(--text-secondary); font-size: 10px; }
.layer-controls { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 8px; }
.ctrl-btn { height: 25px; display: grid; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-2); color: var(--text-secondary); cursor: pointer; }
.ctrl-btn:hover { border-color: rgba(129,140,248,0.35); background: var(--accent-soft); color: #e0e2ff; }
</style>
