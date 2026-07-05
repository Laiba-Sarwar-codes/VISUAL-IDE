// src/layers/LayerDragDropService.ts
// Layer Management — pure drop-target resolution for the layer tree's
// native HTML5 drag-and-drop. Returns the next SceneObject[] (or null for
// an invalid drop) — LayerTree.vue/LayerTreeNode.vue only need to call
// this and hand the result to scene.reparent(); no DnD library needed.

import { reparent } from './LayerHierarchyService'
import { wouldCreateCycle } from './layerValidation'
import type { SceneObject } from '../engine/scene-graph/types'

export type DropPosition = 'before' | 'after' | 'inside'

/**
 * Why "before"/"after" invert relative to ascending zIndex: the layer
 * panel displays top-of-stack (highest zIndex) first, at the top of the
 * list (see LayerTreeService.flattenVisible). So dropping "before" a
 * target row (visually above it) means the dragged item should end up
 * with a HIGHER zIndex than the target — i.e. inserted right AFTER the
 * target in the ascending-zIndex sibling order that reparent()'s `index`
 * parameter operates on. "after" is the mirror case.
 */
export function computeDrop(
  objects: SceneObject[],
  draggedId: string,
  targetId: string,
  position: DropPosition
): SceneObject[] | null {
  if (draggedId === targetId) return null
  const dragged = objects.find(o => o.id === draggedId)
  const target = objects.find(o => o.id === targetId)
  if (!dragged || !target) return null

  if (position === 'inside') {
    if (target.type !== 'group' && target.type !== 'folder') return null
    if (wouldCreateCycle(objects, draggedId, targetId)) return null
    return reparent(objects, draggedId, targetId)
  }

  const newParentId = target.parentId ?? null
  if (wouldCreateCycle(objects, draggedId, newParentId)) return null

  const siblings = objects
    .filter(o => o.id !== draggedId && (o.parentId ?? null) === newParentId)
    .sort((a, b) => a.zIndex - b.zIndex)
  const targetIdx = siblings.findIndex(o => o.id === targetId)
  if (targetIdx === -1) return null

  const index = position === 'before' ? targetIdx + 1 : targetIdx
  return reparent(objects, draggedId, newParentId, index)
}

/** Moves an item back to the scene root, appended at the top. */
export function computeDropToRoot(objects: SceneObject[], draggedId: string): SceneObject[] | null {
  const dragged = objects.find(o => o.id === draggedId)
  if (!dragged) return null
  if ((dragged.parentId ?? null) === null) return null
  return reparent(objects, draggedId, null)
}
