// src/layers/LayerAlignmentService.ts
// Layer Management — align and distribute selected objects.
//
// Uses the collective bounding box of eligible (unlocked) selected
// objects, matching the existing bounding-box system used elsewhere in
// the renderer/snap-guides (raw x/y/width/height — this project has no
// separate rotated-AABB concept anywhere, so aligning/distributing by
// the plain box is consistent with everything else, not a shortcut).
//
// "Distribute" and "equal spacing" are implemented as one algorithm
// (equalize the gaps between adjacent bounding boxes, holding the two
// outermost objects fixed) — the spec's two names describe the same
// well-defined outcome, not two different algorithms.

import type { SceneObject } from '../engine/scene-graph/types'

function eligibleTargets(objects: SceneObject[], ids: string[]): SceneObject[] {
  const idSet = new Set(ids)
  return objects.filter(o => idSet.has(o.id) && !o.locked)
}

function collectiveBounds(targets: SceneObject[]) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const o of targets) {
    left = Math.min(left, o.x)
    top = Math.min(top, o.y)
    right = Math.max(right, o.x + o.width)
    bottom = Math.max(bottom, o.y + o.height)
  }
  return { left, top, right, bottom }
}

function applyX(objects: SceneObject[], targets: SceneObject[], x: (o: SceneObject) => number): SceneObject[] {
  const targetIds = new Set(targets.map(o => o.id))
  return objects.map(o => (targetIds.has(o.id) ? { ...o, x: x(o) } : o))
}

function applyY(objects: SceneObject[], targets: SceneObject[], y: (o: SceneObject) => number): SceneObject[] {
  const targetIds = new Set(targets.map(o => o.id))
  return objects.map(o => (targetIds.has(o.id) ? { ...o, y: y(o) } : o))
}

export function alignLeft(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 2) return objects
  const { left } = collectiveBounds(targets)
  return applyX(objects, targets, () => left)
}

export function alignRight(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 2) return objects
  const { right } = collectiveBounds(targets)
  return applyX(objects, targets, o => right - o.width)
}

export function alignHCenter(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 2) return objects
  const { left, right } = collectiveBounds(targets)
  const centerX = (left + right) / 2
  return applyX(objects, targets, o => centerX - o.width / 2)
}

export function alignTop(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 2) return objects
  const { top } = collectiveBounds(targets)
  return applyY(objects, targets, () => top)
}

export function alignBottom(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 2) return objects
  const { bottom } = collectiveBounds(targets)
  return applyY(objects, targets, o => bottom - o.height)
}

export function alignVCenter(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 2) return objects
  const { top, bottom } = collectiveBounds(targets)
  const centerY = (top + bottom) / 2
  return applyY(objects, targets, o => centerY - o.height / 2)
}

/**
 * Why: requires 3+ objects (2 objects have no meaningful "gap" to equalize).
 * Sorts by left edge, holds the first and last object's position fixed,
 * and redistributes the middle ones so every gap between adjacent boxes
 * is equal.
 */
export function distributeHorizontal(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 3) return objects

  const sorted = [...targets].sort((a, b) => a.x - b.x)
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const totalWidth = sorted.reduce((sum, o) => sum + o.width, 0)
  const span = last.x + last.width - first.x
  const gapCount = sorted.length - 1
  const gap = (span - totalWidth) / gapCount
  if (!Number.isFinite(gap)) return objects

  const positions = new Map<string, number>()
  let cursor = first.x
  for (const o of sorted) {
    positions.set(o.id, cursor)
    cursor += o.width + gap
  }
  return objects.map(o => (positions.has(o.id) ? { ...o, x: positions.get(o.id)! } : o))
}

export function distributeVertical(objects: SceneObject[], ids: string[]): SceneObject[] {
  const targets = eligibleTargets(objects, ids)
  if (targets.length < 3) return objects

  const sorted = [...targets].sort((a, b) => a.y - b.y)
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const totalHeight = sorted.reduce((sum, o) => sum + o.height, 0)
  const span = last.y + last.height - first.y
  const gapCount = sorted.length - 1
  const gap = (span - totalHeight) / gapCount
  if (!Number.isFinite(gap)) return objects

  const positions = new Map<string, number>()
  let cursor = first.y
  for (const o of sorted) {
    positions.set(o.id, cursor)
    cursor += o.height + gap
  }
  return objects.map(o => (positions.has(o.id) ? { ...o, y: positions.get(o.id)! } : o))
}
