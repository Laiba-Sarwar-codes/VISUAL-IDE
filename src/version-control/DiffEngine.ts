// src/version-control/DiffEngine.ts
// Module 20 — snapshot diff computation

import type { Snapshot, DiffResult, CommitStats } from './types'
import type { SceneObject } from '../engine/scene-graph/types'

// Fields we track for change detection. Skipping runtime-only fields
// like zIndex would understate real changes.
const TRACKED_FIELDS: Array<keyof SceneObject> = [
  'name', 'type', 'x', 'y', 'width', 'height', 'rotation',
  'visible', 'locked', 'opacity', 'fill', 'stroke', 'zIndex',
  'text', 'assetId',
]

/**
 * Why: computes the full diff between two snapshots. Kept as a pure
 * function so it's trivially testable and reusable — the commit
 * creation flow calls this for stats, the diff UI calls this for
 * detailed display.
 * Inputs: before snapshot (nullable — null means "empty state"),
 *         after snapshot (the newer state).
 * Output: DiffResult categorizing all changes.
 * Called by: VersionControlService.createCommit() and diff view.
 */
export function computeDiff(
  before: Snapshot | null,
  after: Snapshot
): DiffResult {
  const beforeMap = new Map<string, SceneObject>()
  const afterMap = new Map<string, SceneObject>()

  if (before) {
    for (const obj of before.objects) beforeMap.set(obj.id, obj)
  }
  for (const obj of after.objects) afterMap.set(obj.id, obj)

  const added: SceneObject[] = []
  const removed: SceneObject[] = []
  const modified: DiffResult['modified'] = []
  let unchanged = 0

  // Detect added and modified
  for (const [id, afterObj] of afterMap) {
    const beforeObj = beforeMap.get(id)
    if (!beforeObj) {
      added.push(afterObj)
      continue
    }

    const changedFields = getChangedFields(beforeObj, afterObj)
    if (changedFields.length > 0) {
      modified.push({ before: beforeObj, after: afterObj, changedFields })
    } else {
      unchanged++
    }
  }

  // Detect removed
  for (const [id, beforeObj] of beforeMap) {
    if (!afterMap.has(id)) removed.push(beforeObj)
  }

  return { added, removed, modified, unchanged }
}

/**
 * Why: returns array of field names that differ between two objects.
 * Uses strict equality — no epsilon comparison since scene properties
 * are user-set and any change should register.
 */
function getChangedFields(before: SceneObject, after: SceneObject): string[] {
  const changed: string[] = []
  for (const field of TRACKED_FIELDS) {
    if (before[field] !== after[field]) changed.push(field as string)
  }
  return changed
}

/**
 * Why: convenience wrapper returning just the counts, used to
 * pre-populate CommitStats without holding the full DiffResult.
 */
export function computeStats(
  before: Snapshot | null,
  after: Snapshot
): CommitStats {
  const diff = computeDiff(before, after)
  return {
    added: diff.added.length,
    removed: diff.removed.length,
    modified: diff.modified.length,
  }
}