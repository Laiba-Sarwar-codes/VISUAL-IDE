// src/engine/scene-graph/hitTest.ts
// Module 6 — fixed: added image case and default return false
// Layer Management — hit-testing is now hierarchy-aware: folders/groups
// are never direct hit targets (organizational/bounding-box only), the
// true paint order (not raw zIndex, which is only sibling-scoped now) is
// used to find the topmost leaf, ancestor visibility/lock is enforced,
// and clicking a leaf inside a group selects the outermost group unless
// the caller has "entered" that group (double-click drill-in).

import { buildPaintOrder, getEffectiveLocked, getEffectiveVisibility, getOutermostGroup } from '../../layers/LayerTreeService'
import { isDescendantOf } from '../../layers/layerValidation'
import type { SceneObject } from './types'

/**
 * @param enteredGroupId - when set (via double-click drill-in), hits on
 * descendants of this group return the leaf itself instead of collapsing
 * up to the outermost group.
 */
export function hitTestObjects(
  worldX: number,
  worldY: number,
  objects: SceneObject[],
  enteredGroupId: string | null = null
): SceneObject | null {
  const paintOrder = buildPaintOrder(objects) // bottom → top, leaf ids only
  const byId = new Map(objects.map(o => [o.id, o]))

  for (let i = paintOrder.length - 1; i >= 0; i--) {
    const obj = byId.get(paintOrder[i]!)
    if (!obj) continue
    if (!getEffectiveVisibility(objects, obj.id) || getEffectiveLocked(objects, obj.id)) continue
    if (!hitTestSingle(worldX, worldY, obj)) continue

    if (enteredGroupId && isDescendantOf(objects, enteredGroupId, obj.id)) {
      return obj // drilled in — select the actual leaf
    }

    const outermostGroupId = getOutermostGroup(objects, obj.id)
    if (!outermostGroupId) return obj
    return byId.get(outermostGroupId) ?? obj
  }
  return null
}

// Fixed: added 'image' case and default return false so all
// SceneObjectType values are handled exhaustively
function hitTestSingle(
  worldX: number,
  worldY: number,
  obj: SceneObject
): boolean {
  switch (obj.type) {
    case 'rectangle':
    case 'text':
    case 'image':
      return hitTestRect(worldX, worldY, obj)
    case 'ellipse':
      return hitTestEllipse(worldX, worldY, obj)
    default:
      return false
  }
}

function hitTestRect(
  worldX: number,
  worldY: number,
  obj: SceneObject
): boolean {
  return (
    worldX >= obj.x &&
    worldX <= obj.x + obj.width &&
    worldY >= obj.y &&
    worldY <= obj.y + obj.height
  )
}

function hitTestEllipse(
  worldX: number,
  worldY: number,
  obj: SceneObject
): boolean {
  const rx = obj.width / 2
  const ry = obj.height / 2
  const cx = obj.x + rx
  const cy = obj.y + ry
  const dx = (worldX - cx) / rx
  const dy = (worldY - cy) / ry
  return dx * dx + dy * dy <= 1
}