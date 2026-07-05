<!-- app/components/layers/LayerTree.vue -->
<!-- Layer Management — hierarchical layer tree root. Owns click-selection
     rules (plain/shift-range/ctrl-toggle) via LayerTreeService.flattenVisible
     and hands drag-drop results to scene.applyLayerTreeChange(). -->
<template>
  <ul class="layer-tree" role="tree" aria-label="Layer hierarchy">
    <LayerTreeNode
      v-for="node in tree"
      :key="node.id"
      :node="node"
      :depth="0"
      @select="handleSelect"
      @toggle-expand="handleToggleExpand"
      @rename="handleRename"
      @delete-node="handleDelete"
      @drop-node="handleDropNode"
    />

    <li
      class="root-drop-zone"
      :class="{ active: isRootDropActive }"
      @dragover.prevent="isRootDropActive = true"
      @dragleave="isRootDropActive = false"
      @drop="handleDropToRoot"
    >
      Drop here to move to root
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '~/stores/editor'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'
import { buildTree, flattenVisible } from '~~/src/layers/LayerTreeService'
import { computeDrop, computeDropToRoot, type DropPosition } from '~~/src/layers/LayerDragDropService'
import type { LayerTreeNode as LayerTreeNodeModel } from '~~/src/layers/types'
import LayerTreeNode from './LayerTreeNode.vue'

const editor = useEditorStore()
const scene = useSceneStore()
const selection = useSelectionStore()

// Panel displays top-of-stack first at every level.
const tree = computed(() => [...buildTree(scene.objects)].reverse())

function handleSelect(node: LayerTreeNodeModel, event: MouseEvent): void {
  if (event.shiftKey) {
    const order = flattenVisible(scene.objects)
    const anchor = selection.selectedId ?? node.id
    const anchorIdx = order.indexOf(anchor)
    const targetIdx = order.indexOf(node.id)
    if (anchorIdx === -1 || targetIdx === -1) {
      selection.select(node.id)
    } else {
      const [start, end] = anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx]
      selection.selectRange(order.slice(start, end + 1))
    }
  } else if (event.ctrlKey || event.metaKey) {
    selection.toggleSelect(node.id)
  } else {
    selection.select(node.id)
  }
  editor.setStatusMessage(`Selected: ${node.name}`)
}

function handleToggleExpand(node: LayerTreeNodeModel): void {
  scene.setExpanded(node.id, !node.expanded)
}

function handleRename(node: LayerTreeNodeModel, name: string): void {
  scene.renameNode(node.id, name)
}

function handleDelete(node: LayerTreeNodeModel): void {
  if (node.kind === 'folder') {
    scene.deleteFolder(node.id)
  } else {
    scene.removeObject(node.id)
  }
  if (selection.isSelected(node.id)) selection.toggleSelect(node.id)
}

function handleDropNode(draggedId: string, targetId: string, position: DropPosition): void {
  const next = computeDrop(scene.objects, draggedId, targetId, position)
  if (next) scene.applyLayerTreeChange(next, 'Move Layer')
}

const isRootDropActive = ref(false)

function handleDropToRoot(e: DragEvent): void {
  e.preventDefault()
  isRootDropActive.value = false
  const draggedId = e.dataTransfer?.getData('text/plain')
  if (!draggedId) return
  const next = computeDropToRoot(scene.objects, draggedId)
  if (next) scene.applyLayerTreeChange(next, 'Move to Root')
}
</script>

<style scoped>
.layer-tree { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.root-drop-zone {
  margin-top: 6px;
  padding: 10px;
  border: 1px dashed var(--border);
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 9px;
  text-align: center;
}
.root-drop-zone.active { border-color: var(--accent); color: var(--text-secondary); background: var(--accent-soft); }
</style>
