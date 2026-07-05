// src/layers/LayerExportUtils.ts
// Layer Management — flattens the hierarchy into a leaf-only, already-
// paint-ordered list with effective (ancestor-resolved) opacity/blend
// mode baked in, so existing visual exporters (PNG/SVG/PDF/HTML) keep
// their zIndex-sort + per-object paint logic unmodified. JSON/ZIP project
// exports must NOT use this — they need the raw hierarchy for full
// round-trip fidelity (see SVGExporter.ts/PNGExporter.ts/SceneExportUtils.ts
// vs JSONExporter.ts).

import { buildPaintOrder, getEffectiveBlendMode, getEffectiveOpacity, getEffectiveVisibility } from './LayerTreeService'
import type { SceneObject } from '../engine/scene-graph/types'

export function flattenForExport(objects: SceneObject[], includeInvisible = false): SceneObject[] {
  const byId = new Map(objects.map(o => [o.id, o]))
  const paintOrder = buildPaintOrder(objects)

  const result: SceneObject[] = []
  let nextZIndex = 0
  for (const id of paintOrder) {
    const obj = byId.get(id)
    if (!obj) continue
    if (!includeInvisible && !getEffectiveVisibility(objects, id)) continue
    result.push({
      ...obj,
      zIndex: nextZIndex++,
      opacity: getEffectiveOpacity(objects, id),
      blendMode: getEffectiveBlendMode(objects, id),
    })
  }
  return result
}
