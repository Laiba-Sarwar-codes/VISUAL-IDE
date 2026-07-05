// src/engine/performance/culling.ts
// Module 11 — filters scene objects to only those visible in viewport

import type { Camera } from '../rendering/Camera'
import type { SceneObject } from '../scene-graph/types'
import { getObjectBounds, boundsOverlap } from './bounds'
import { getViewportBounds } from './viewport'

/**
 * Why: rendering all objects every frame is O(n) in object count even
 * when most objects are off-screen. Culling reduces the rendered set to
 * only objects whose bounding boxes overlap the visible viewport, making
 * the render cost proportional to visible object count rather than total
 * object count.
 *
 * This matters at 500+ objects where the difference between drawing 500
 * vs 20 visible objects is significant on every frame.
 *
 * Inputs: objects — full scene array (any order);
 *         camera — current camera state;
 *         cssWidth/cssHeight — canvas logical dimensions.
 * Output: filtered array containing only objects that overlap the
 *         current viewport. Order is preserved so zIndex sort in
 *         ShapeRenderer still works correctly.
 * Called by: Renderer.draw() before passing objects to ShapeRenderer.
 */
export function getVisibleObjects(
  objects: SceneObject[],
  camera: Camera,
  cssWidth: number,
  cssHeight: number
): SceneObject[] {
  // Always skip invisible objects first — no bounds check needed
  const visible = objects.filter(obj => obj.visible)

  const viewport = getViewportBounds(camera, cssWidth, cssHeight)

  return visible.filter(obj => {
    const bounds = getObjectBounds(obj)
    return boundsOverlap(bounds, viewport)
  })
}

/**
 * Why: useful for the performance monitor and stress test to report
 * how many objects were culled this frame vs total object count.
 * Output: { total, visible, culled } counts.
 * Called by: PerformanceMonitor (Chunk 2).
 */
export function getCullingStats(
  objects: SceneObject[],
  camera: Camera,
  cssWidth: number,
  cssHeight: number
): { total: number; visible: number; culled: number } {
  const total = objects.length
  const visible = getVisibleObjects(objects, camera, cssWidth, cssHeight).length
  return { total, visible, culled: total - visible }
}