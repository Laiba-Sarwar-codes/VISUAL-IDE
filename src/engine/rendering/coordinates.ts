// src/engine/rendering/coordinates.ts
// Module 4 — stateless screen-space math helpers, separate from Camera
// so they can be reused without depending on camera state.

import type { ScreenPoint } from './Types'

/**
 * Why: pointer events give coordinates relative to the browser window;
 * we need coordinates relative to the canvas element itself.
 * Inputs: raw clientX/clientY, and the canvas element's bounding rect.
 * Output: a ScreenPoint relative to the canvas element's top-left.
 * Called by: CanvasController's wheel handler.
 */
export function getRelativeScreenPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect
): ScreenPoint {
  return { x: clientX - rect.left, y: clientY - rect.top }
}

/**
 * Why: zoom is centered on the canvas element's middle, so Camera's
 * screen/world conversions need this point.
 * Inputs: the canvas element's bounding rect.
 * Output: a ScreenPoint at the center of that rect.
 * Called by: CanvasController's wheel handler, drawGrid.
 */
export function getViewportCenter(rect: DOMRect): ScreenPoint {
  return { x: rect.width / 2, y: rect.height / 2 }
}

/**
 * Why: wheel deltaY varies wildly across devices. Normalizes it into a
 * consistent multiplicative zoom factor.
 * Inputs: raw deltaY from a WheelEvent.
 * Output: a multiplicative zoom factor (e.g. 1.05 = zoom in slightly).
 * Called by: CanvasController's wheel handler.
 */
export function normalizeWheelToZoomFactor(deltaY: number): number {
  const ZOOM_SENSITIVITY = 0.001
  return Math.exp(-deltaY * ZOOM_SENSITIVITY)
}