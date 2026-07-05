// src/engine/performance/viewport.ts
// Module 11 — computes visible world-space viewport bounds from camera

import type { Camera } from '../rendering/Camera'
import type { BoundingBox } from './bounds'

/**
 * Why: culling requires knowing the visible region in world space.
 * The camera's screenToWorld converts the four canvas corners (screen
 * space) into world coordinates, giving us the exact world rectangle
 * that's currently on screen.
 * Inputs: camera — current camera state; cssWidth/cssHeight — logical
 *         canvas pixel dimensions (not raw buffer size).
 * Output: BoundingBox in world space representing the visible area.
 * Called by: getVisibleObjects every render frame.
 */
export function getViewportBounds(
  camera: Camera,
  cssWidth: number,
  cssHeight: number
): BoundingBox {
  const center = { x: cssWidth / 2, y: cssHeight / 2 }

  const topLeft     = camera.screenToWorld({ x: 0,        y: 0 },         center)
  const bottomRight = camera.screenToWorld({ x: cssWidth, y: cssHeight }, center)

  // Add a small margin (one grid cell worth) so objects at the exact
  // edge of the viewport don't flicker as they're culled.
  const MARGIN = 64 // world units

  return {
    left:   topLeft.x - MARGIN,
    top:    topLeft.y - MARGIN,
    right:  bottomRight.x + MARGIN,
    bottom: bottomRight.y + MARGIN,
  }
}