// src/layers/LayerHierarchyService.ts
// Layer Management — reparent / create-folder / delete-folder / rename,
// all as pure functions over SceneObject[] so scene.ts can wrap each one
// in the store's existing snapshot-before/after + single history record
// pattern (see app/stores/scene.ts).

import { LayerManager } from '../engine/layers/LayerManager'
import { createSceneObject } from '../engine/scene-graph/createSceneObject'
import type { SceneObject } from '../engine/scene-graph/types'
import { wouldCreateCycle } from './layerValidation'

/**
 * Why: moves childId under newParentId. `index` (optional) is a 0-based
 * position among the *new* siblings (by ascending zIndex) to insert
 * before; omitted means "append at the top" (existing bringToFront
 * convention). Rejects the move (returns objects unchanged) if it would
 * create a circular ancestry.
 */
export function reparent(
  objects: SceneObject[],
  childId: string,
  newParentId: string | null,
  index?: number
): SceneObject[] {
  if (wouldCreateCycle(objects, childId, newParentId)) return objects
  const child = objects.find(o => o.id === childId)
  if (!child) return objects

  const siblings = objects
    .filter(o => o.id !== childId && (o.parentId ?? null) === newParentId)
    .sort((a, b) => a.zIndex - b.zIndex)

  let targetZIndex: number
  if (index === undefined) {
    targetZIndex = siblings.length > 0 ? Math.max(...siblings.map(o => o.zIndex)) + 1 : 0
  } else {
    const clamped = Math.max(0, Math.min(index, siblings.length))
    const before = siblings[clamped - 1]
    const after = siblings[clamped]
    if (before && after) targetZIndex = (before.zIndex + after.zIndex) / 2
    else if (after) targetZIndex = after.zIndex - 1
    else if (before) targetZIndex = before.zIndex + 1
    else targetZIndex = 0
  }

  const updated = objects.map(o =>
    o.id === childId ? { ...o, parentId: newParentId, zIndex: targetZIndex } : o
  )
  return LayerManager.normalize(updated, newParentId)
}

export function createFolder(
  objects: SceneObject[],
  name: string,
  parentId: string | null = null
): { objects: SceneObject[]; folderId: string } {
  const siblings = objects.filter(o => (o.parentId ?? null) === parentId)
  const nextZIndex = siblings.length > 0 ? Math.max(...siblings.map(o => o.zIndex)) + 1 : 0
  const folder = createSceneObject({ type: 'folder', name, parentId }, nextZIndex)
  return { objects: [...objects, folder], folderId: folder.id }
}

/**
 * Why: folders are organizational only — deleting one must not delete its
 * contents. Children are promoted to the folder's own parent (safe
 * default per spec), then that sibling scope is renumbered so the
 * promoted children merge cleanly into the existing order.
 */
export function deleteFolder(objects: SceneObject[], folderId: string): SceneObject[] {
  const folder = objects.find(o => o.id === folderId)
  if (!folder || folder.type !== 'folder') return objects

  const grandParentId = folder.parentId ?? null
  const withoutFolder = objects.filter(o => o.id !== folderId)
  const promoted = withoutFolder.map(o =>
    (o.parentId ?? null) === folderId ? { ...o, parentId: grandParentId } : o
  )
  return LayerManager.normalize(promoted, grandParentId)
}

export function renameNode(objects: SceneObject[], id: string, name: string): SceneObject[] {
  const trimmed = name.trim()
  if (!trimmed) return objects
  return objects.map(o => (o.id === id ? { ...o, name: trimmed } : o))
}
