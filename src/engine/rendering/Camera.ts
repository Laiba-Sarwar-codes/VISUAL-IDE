// src/engine/rendering/Camera.ts
// Module 4 — Camera model: owns viewport position + zoom, and the math
// to convert between screen space and world space.

import type { CameraState, CameraLimits, ScreenPoint, WorldPoint } from './Types'

const DEFAULT_LIMITS: CameraLimits = { minZoom: 0.1, maxZoom: 8 }

export class Camera {
  x: number
  y: number
  zoom: number
  private limits: CameraLimits

  constructor(initial: Partial<CameraState> = {}, limits: CameraLimits = DEFAULT_LIMITS) {
    this.x = initial.x ?? 0
    this.y = initial.y ?? 0
    this.zoom = initial.zoom ?? 1
    this.limits = limits
  }

  /**
   * Why: panning moves the camera in world units, not screen pixels,
   * so the grid appears to drag under the cursor.
   * Inputs: dx/dy — raw screen-pixel delta the user dragged.
   * Output: none (mutates camera position).
   * Called by: CanvasController's pointermove handler, while dragging.
   */
  panByScreenDelta(dx: number, dy: number): void {
    this.x -= dx / this.zoom
    this.y -= dy / this.zoom
  }

  /**
   * Why: zoom toward cursor — solves for new camera x/y so the same
   * world point stays under the cursor before and after zooming.
   * Inputs: screenPoint (relative to canvas top-left), viewportCenter
   *         (canvas width/2, height/2), zoomDelta (multiplicative factor).
   * Output: none (mutates camera x/y/zoom).
   * Called by: CanvasController's wheel handler.
   */
  zoomAtScreenPoint(screenPoint: ScreenPoint, viewportCenter: ScreenPoint, zoomDelta: number): void {
    const worldBefore = this.screenToWorld(screenPoint, viewportCenter)
    this.zoom = this.clampZoom(this.zoom * zoomDelta)
    const worldAfterIfUnadjusted = this.screenToWorld(screenPoint, viewportCenter)
    this.x += worldBefore.x - worldAfterIfUnadjusted.x
    this.y += worldBefore.y - worldAfterIfUnadjusted.y
  }

  /**
   * Why: converts a screen-space point into world-space coordinates.
   * Inputs: screenPoint relative to canvas top-left; viewportCenter.
   * Output: the equivalent WorldPoint.
   * Called by: zoomAtScreenPoint, drawGrid.
   */
  screenToWorld(screenPoint: ScreenPoint, viewportCenter: ScreenPoint): WorldPoint {
    return {
      x: this.x + (screenPoint.x - viewportCenter.x) / this.zoom,
      y: this.y + (screenPoint.y - viewportCenter.y) / this.zoom,
    }
  }

  /**
   * Why: inverse of screenToWorld — needed to draw world-space content
   * (the grid) at the correct screen pixel position.
   * Inputs: a WorldPoint and viewportCenter.
   * Output: the equivalent ScreenPoint.
   * Called by: drawGrid.
   */
  worldToScreen(worldPoint: WorldPoint, viewportCenter: ScreenPoint): ScreenPoint {
    return {
      x: (worldPoint.x - this.x) * this.zoom + viewportCenter.x,
      y: (worldPoint.y - this.y) * this.zoom + viewportCenter.y,
    }
  }

  /**
   * Why: prevents zooming infinitely in/out.
   * Inputs: a proposed zoom value.
   * Output: the value clamped to [minZoom, maxZoom].
   * Called by: zoomAtScreenPoint, internally only.
   */
  private clampZoom(value: number): number {
    return Math.min(this.limits.maxZoom, Math.max(this.limits.minZoom, value))
  }

  getState(): CameraState {
    return { x: this.x, y: this.y, zoom: this.zoom }
  }
}