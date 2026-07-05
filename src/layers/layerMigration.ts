// src/layers/layerMigration.ts
// Layer Management — defensive, idempotent hierarchy repair.
//
// Why a normalize pass instead of a version-gated migration: SceneObject's
// new fields are optional, so old flat projects load fine as-is — every
// object simply has parentId === undefined. Running this on every load
// (project open, CRDT remote-replace, version-control restore) fills that
// in as null (root) and repairs any dangling/circular parentId, so the
// app never has to reason about malformed hierarchy data downstream.

import type { SceneObject } from '../engine/scene-graph/types'

function isInCycle(id: string, byId: Map<string, SceneObject>): boolean {
  const seen = new Set<string>()
  let current: string | null = id
  while (current !== null) {
    if (seen.has(current)) return true
    seen.add(current)
    const obj = byId.get(current)
    current = obj ? obj.parentId ?? null : null
  }
  return false
}

export function normalizeHierarchy(objects: SceneObject[]): SceneObject[] {
  const idSet = new Set(objects.map(o => o.id))

  // Step 1: fill missing parentId, drop dangling references (parent that
  // no longer exists in the array) back to root.
  let result = objects.map((o): SceneObject => ({
    ...o,
    parentId: o.parentId != null && idSet.has(o.parentId) ? o.parentId : null,
  }))

  // Step 2: break any circular chains by resetting every node that
  // participates in one back to root. Safe/idempotent — re-running finds
  // no cycles the second time.
  const byId = new Map(result.map(o => [o.id, o]))
  result = result.map(o => (isInCycle(o.id, byId) ? { ...o, parentId: null } : o))

  return result
}
