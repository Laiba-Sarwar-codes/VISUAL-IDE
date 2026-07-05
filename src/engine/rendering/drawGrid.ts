// src/engine/rendering/drawGrid.ts
// Module 4 — pure function that draws the infinite grid onto a 2D context.

import type { Camera } from './Camera'
import type { ScreenPoint } from './Types'

const BASE_GRID_SIZE = 32
const LINE_COLOR = '#1c1c1c'
const BACKGROUND_COLOR = '#0d0d0d'

/**
 * Why: this is the visual output of Module 4 — a grid that stays
 * visually consistent as the user zooms and shifts correctly as they pan.
 * Inputs: ctx, CSS-pixel width/height of the canvas (NOT raw buffer
 *         width/height — see CanvasWorkspace.vue note below), and Camera.
 * Output: none (draws onto ctx).
 * Called by: CanvasWorkspace's render loop.
 */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: Camera
): void {
  ctx.fillStyle = BACKGROUND_COLOR
  ctx.fillRect(0, 0, width, height)

  const center: ScreenPoint = { x: width / 2, y: height / 2 }
  const topLeft = camera.screenToWorld({ x: 0, y: 0 }, center)
  const bottomRight = camera.screenToWorld({ x: width, y: height }, center)

  const gridSize = getAdaptiveGridSize(camera.zoom)

  const startX = Math.floor(topLeft.x / gridSize) * gridSize
  const endX = Math.ceil(bottomRight.x / gridSize) * gridSize
  const startY = Math.floor(topLeft.y / gridSize) * gridSize
  const endY = Math.ceil(bottomRight.y / gridSize) * gridSize

  ctx.strokeStyle = LINE_COLOR
  ctx.lineWidth = 1
  ctx.beginPath()

  for (let x = startX; x <= endX; x += gridSize) {
    const screenX = camera.worldToScreen({ x, y: 0 }, center).x
    ctx.moveTo(screenX, 0)
    ctx.lineTo(screenX, height)
  }

  for (let y = startY; y <= endY; y += gridSize) {
    const screenY = camera.worldToScreen({ x: 0, y }, center).y
    ctx.moveTo(0, screenY)
    ctx.lineTo(width, screenY)
  }

  ctx.stroke()
}

function getAdaptiveGridSize(zoom: number): number {
  let size = BASE_GRID_SIZE
  while (size * zoom < 16) size *= 2
  while (size * zoom > 128) size /= 2
  return size
}