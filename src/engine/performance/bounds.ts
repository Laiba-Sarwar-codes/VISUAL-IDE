// src/engine/performance/bounds.ts
// Module 11 — world-space bounding box calculations

import type { SceneObject } from '../scene-graph/types'

export interface BoundingBox {
  left: number
  top: number
  right: number
  bottom: number
}

export function getObjectBounds(obj: SceneObject): BoundingBox {
  switch (obj.type) {
    case 'rectangle':
    case 'text':
    case 'image':
      return {
        left:   obj.x,
        top:    obj.y,
        right:  obj.x + obj.width,
        bottom: obj.y + obj.height,
      }
    case 'ellipse':
      // Conservative AABB — safe overestimate for culling
      return {
        left:   obj.x,
        top:    obj.y,
        right:  obj.x + obj.width,
        bottom: obj.y + obj.height,
      }
    default:
      // Exhaustive fallback — TypeScript now knows all cases are covered
      return {
        left:   obj.x,
        top:    obj.y,
        right:  obj.x + obj.width,
        bottom: obj.y + obj.height,
      }
  }
}

export function boundsOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  )
}