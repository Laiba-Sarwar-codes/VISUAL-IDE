// src/engine/rendering/drawSelection.ts
// Module 6 — draws selection border and corner handles

import type { Camera } from './Camera'
import type { SceneObject } from '../scene-graph/types'

const BORDER_COLOR = '#3b82f6'
const HANDLE_SIZE = 8
const HANDLE_COLOR = '#ffffff'

/**
 * Why: draws the blue selection border and four corner handles around
 * a selected object. All coordinates are converted from world space to
 * screen space via the Camera so the selection scales and pans with
 * the canvas correctly.
 * Inputs: ctx, cssWidth/cssHeight, camera, the selected SceneObject.
 * Output: none (draws onto ctx).
 * Called by: CanvasWorkspace render function, after drawObjects.
 */
export function drawSelection(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  camera: Camera,
  obj: SceneObject
): void {
  const center = { x: cssWidth / 2, y: cssHeight / 2 }
  const screenPos = camera.worldToScreen({ x: obj.x, y: obj.y }, center)
  const sw = obj.width * camera.zoom
  const sh = obj.height * camera.zoom

  // Selection border
  ctx.save()
  ctx.strokeStyle = BORDER_COLOR
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.strokeRect(screenPos.x - 1, screenPos.y - 1, sw + 2, sh + 2)
  ctx.restore()

  // Corner handles — visual only, no resize logic yet
  const corners = [
    { x: screenPos.x,      y: screenPos.y },
    { x: screenPos.x + sw, y: screenPos.y },
    { x: screenPos.x,      y: screenPos.y + sh },
    { x: screenPos.x + sw, y: screenPos.y + sh },
  ]

  ctx.save()
  for (const corner of corners) {
    ctx.fillStyle = HANDLE_COLOR
    ctx.strokeStyle = BORDER_COLOR
    ctx.lineWidth = 2
    ctx.fillRect(
      corner.x - HANDLE_SIZE / 2,
      corner.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    )
    ctx.strokeRect(
      corner.x - HANDLE_SIZE / 2,
      corner.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE
    )
  }
  ctx.restore()
}