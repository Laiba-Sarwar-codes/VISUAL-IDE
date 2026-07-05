// src/layers/LayerGroupingService.ts
// Layer Management — group / ungroup, and the group-cascade-delete rule
// (deleting a group deletes its contents; deleting a folder does not —
// see LayerHierarchyService.deleteFolder for the folder case).
//
// Children keep their absolute x/y — grouping never transforms coordinates
// (see plan decision #2). A group's own x/y/width/height is a cached
// bounding box of its children, recomputed here and after a group drag.

import { LayerManager } from '../engine/layers/LayerManager'
import { createSceneObject } from '../engine/scene-graph/createSceneObject'
import type { SceneObject } from '../engine/scene-graph/types'

function computeBounds(objects: SceneObject[]): { left: number; top: number; width: number; height: number } {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const o of objects) {
    left = Math.min(left, o.x)
    top = Math.min(top, o.y)
    right = Math.max(right, o.x + o.width)
    bottom = Math.max(bottom, o.y + o.height)
  }
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * Why: groups every eligible (unlocked) object in `ids` under a new
 * 'group' object. The group is placed as a sibling of the first eligible
 * object (its parentId), so a same-parent multi-select groups cleanly;
 * a mixed-parent selection still groups without crashing, just under the
 * first member's parent — a defensible simplification, not a crash path.
 * Object ids, absolute positions and relative z-order of the grouped
 * members are all preserved.
 */
export function groupObjects(
  objects: SceneObject[],
  ids: string[]
): { objects: SceneObject[]; groupId: string | null } {
  const eligible = objects.filter(o => ids.includes(o.id) && !o.locked)
  if (eligible.length === 0) return { objects, groupId: null }

  const targetParentId = eligible[0]!.parentId ?? null
  const bounds = computeBounds(eligible)
  const targetScopeZIndexes = objects
    .filter(o => (o.parentId ?? null) === targetParentId)
    .map(o => o.zIndex)
  const nextZIndex = targetScopeZIndexes.length > 0 ? Math.max(...targetScopeZIndexes) + 1 : 0

  const group = createSceneObject({
    type: 'group',
    name: 'Group',
    x: bounds.left,
    y: bounds.top,
    width: bounds.width,
    height: bounds.height,
    parentId: targetParentId,
  }, nextZIndex)

  // Preserve relative order among the grouped members via their pre-group zIndex.
  const sortedEligible = [...eligible].sort((a, b) => a.zIndex - b.zIndex)
  const rankById = new Map(sortedEligible.map((o, i) => [o.id, i]))

  let updated: SceneObject[] = [...objects, group].map(o => {
    const rank = rankById.get(o.id)
    if (rank === undefined) return o
    return { ...o, parentId: group.id, zIndex: rank }
  })
  updated = LayerManager.normalize(updated, group.id)

  return { objects: updated, groupId: group.id }
}

/** Reparents the group's children to the group's own parent (preserving order), then removes the group. */
export function ungroupObjects(objects: SceneObject[], groupId: string): SceneObject[] {
  const group = objects.find(o => o.id === groupId)
  if (!group || group.type !== 'group') return objects

  const grandParentId = group.parentId ?? null
  const withoutGroup = objects.filter(o => o.id !== groupId)
  const promoted = withoutGroup.map(o =>
    (o.parentId ?? null) === groupId ? { ...o, parentId: grandParentId } : o
  )
  return LayerManager.normalize(promoted, grandParentId)
}

/** Recomputes a group's cached bounding box from its current children — call after a group drag/move. */
export function recomputeGroupBounds(objects: SceneObject[], groupId: string): SceneObject[] {
  const children = objects.filter(o => (o.parentId ?? null) === groupId)
  if (children.length === 0) return objects
  const bounds = computeBounds(children)
  return objects.map(o =>
    o.id === groupId
      ? { ...o, x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height }
      : o
  )
}

/** All ids reachable from (and including) `id` by following parentId downward. */
export function collectDescendantsAndSelf(objects: SceneObject[], id: string): Set<string> {
  const result = new Set<string>([id])
  let changed = true
  while (changed) {
    changed = false
    for (const o of objects) {
      const parentId = o.parentId ?? null
      if (parentId !== null && result.has(parentId) && !result.has(o.id)) {
        result.add(o.id)
        changed = true
      }
    }
  }
  return result
}

/**
 * Why: deleting a group is a cascading delete (it's a real visual
 * composition — like Figma, removing it removes its contents). Deleting
 * a folder is handled separately (LayerHierarchyService.deleteFolder)
 * and never cascades. Non-group ids pass through untouched.
 */
export function expandDeletionForGroups(objects: SceneObject[], ids: string[]): string[] {
  const expanded = new Set<string>()
  for (const id of ids) {
    const obj = objects.find(o => o.id === id)
    if (obj && obj.type === 'group') {
      for (const d of collectDescendantsAndSelf(objects, id)) expanded.add(d)
    } else {
      expanded.add(id)
    }
  }
  return [...expanded]
}
