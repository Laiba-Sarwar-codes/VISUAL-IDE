// src/engine/layers/LayerManager.ts
// Module 7 — normalize sorts by zIndex then reassigns sequentially
// Layer Management — added an optional sibling-scope (parentId) parameter
// to every method. Omitted (default null), objects are matched by
// `(o.parentId ?? null) === null` — i.e. every pre-existing object (none
// of which have a parentId) — so behavior for flat/root-level scenes is
// byte-for-byte identical to before this change.

import type { SceneObject } from '../scene-graph/types'

function inScope(obj: SceneObject, parentId: string | null): boolean {
  return (obj.parentId ?? null) === parentId
}

export class LayerManager {
  /**
   * Why: normalize sorts the objects sharing `parentId` by their current
   * zIndex (ascending) then reassigns clean sequential values 0,1,2,...
   * Objects outside that scope are left untouched. Callers that want to
   * change order must SET the zIndex values they want BEFORE calling
   * normalize — normalize will then sort and clean up the values.
   */
  static normalize(objects: SceneObject[], parentId: string | null = null): SceneObject[] {
    const scoped = objects.filter(o => inScope(o, parentId))
    const others = objects.filter(o => !inScope(o, parentId))
    const sorted = [...scoped].sort((a, b) => a.zIndex - b.zIndex)
    const renumbered = sorted.map((obj, i): SceneObject => ({ ...obj, zIndex: i }))
    return others.length > 0 ? [...others, ...renumbered] : renumbered
  }

  /**
   * Why: swap zIndex values of target and the sibling above it (within
   * the same parentId scope), then normalize re-sorts by those values to
   * produce the correct order.
   */
  static bringForward(objects: SceneObject[], id: string, parentId: string | null = null): SceneObject[] {
    const scoped = objects.filter(o => inScope(o, parentId)).sort((a, b) => a.zIndex - b.zIndex)
    const idx = scoped.findIndex(o => o.id === id)
    if (idx === -1 || idx >= scoped.length - 1) return objects

    const current = scoped[idx]
    const above = scoped[idx + 1]
    if (!current || !above) return objects

    const currentZIndex = current.zIndex
    const aboveZIndex = above.zIndex
    const updated = objects.map(o => {
      if (o.id === current.id) return { ...o, zIndex: aboveZIndex }
      if (o.id === above.id) return { ...o, zIndex: currentZIndex }
      return o
    })

    return LayerManager.normalize(updated, parentId)
  }

  static sendBackward(objects: SceneObject[], id: string, parentId: string | null = null): SceneObject[] {
    const scoped = objects.filter(o => inScope(o, parentId)).sort((a, b) => a.zIndex - b.zIndex)
    const idx = scoped.findIndex(o => o.id === id)
    if (idx <= 0) return objects

    const current = scoped[idx]
    const below = scoped[idx - 1]
    if (!current || !below) return objects

    const currentZIndex = current.zIndex
    const belowZIndex = below.zIndex
    const updated = objects.map(o => {
      if (o.id === current.id) return { ...o, zIndex: belowZIndex }
      if (o.id === below.id) return { ...o, zIndex: currentZIndex }
      return o
    })

    return LayerManager.normalize(updated, parentId)
  }

  /**
   * Why: assign the target a zIndex higher than all its siblings so
   * normalize sorts it to the end of that scope.
   */
  static bringToFront(objects: SceneObject[], id: string, parentId: string | null = null): SceneObject[] {
    const scoped = objects.filter(o => inScope(o, parentId))
    if (!scoped.find(o => o.id === id)) return objects

    const maxZIndex = Math.max(...scoped.map(o => o.zIndex))
    const updated = objects.map(o =>
      o.id === id ? { ...o, zIndex: maxZIndex + 1 } : o
    )

    return LayerManager.normalize(updated, parentId)
  }

  /**
   * Why: assign the target a zIndex lower than all its siblings so
   * normalize sorts it to the front of that scope (zIndex 0).
   */
  static sendToBack(objects: SceneObject[], id: string, parentId: string | null = null): SceneObject[] {
    const scoped = objects.filter(o => inScope(o, parentId))
    if (!scoped.find(o => o.id === id)) return objects

    const minZIndex = Math.min(...scoped.map(o => o.zIndex))
    const updated = objects.map(o =>
      o.id === id ? { ...o, zIndex: minZIndex - 1 } : o
    )

    return LayerManager.normalize(updated, parentId)
  }
}
