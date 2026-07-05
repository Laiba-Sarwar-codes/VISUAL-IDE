// src/layers/layerValidation.ts
// Layer Management — circular-reference guards and eligibility checks
// shared by LayerHierarchyService, LayerGroupingService and
// LayerDragDropService. Kept dependency-free (pure functions over
// SceneObject[]) so it has no risk of circular imports.

import type { SceneObject } from '../engine/scene-graph/types'

function parentOf(objects: SceneObject[], id: string): string | null {
  const obj = objects.find(o => o.id === id)
  return obj?.parentId ?? null
}

/**
 * Why: walks the parentId chain starting at nodeId. Returns true if
 * candidateAncestorId is found anywhere in that chain (i.e. nodeId is
 * a descendant of candidateAncestorId, directly or nested).
 */
export function isDescendantOf(
  objects: SceneObject[],
  candidateAncestorId: string,
  nodeId: string
): boolean {
  const seen = new Set<string>()
  let current: string | null = parentOf(objects, nodeId)
  while (current !== null) {
    if (current === candidateAncestorId) return true
    if (seen.has(current)) return false // already-cyclic data — stop, don't loop forever
    seen.add(current)
    current = parentOf(objects, current)
  }
  return false
}

/**
 * Why: reparenting nodeId under newParentId is invalid if newParentId
 * IS nodeId, or if newParentId is currently a descendant of nodeId
 * (that would make nodeId its own ancestor once the move applied).
 */
export function wouldCreateCycle(
  objects: SceneObject[],
  nodeId: string,
  newParentId: string | null
): boolean {
  if (newParentId === null) return false
  if (newParentId === nodeId) return true
  return isDescendantOf(objects, nodeId, newParentId)
}

/** Eligible for canvas multi-select / alignment / distribution: not locked. */
export function isEligible(obj: SceneObject): boolean {
  return !obj.locked
}
