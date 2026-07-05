// src/engine/rendering/GridRenderer.ts
// Module 10 — responsible only for drawing the infinite grid

import type { Camera } from './Camera'

const BASE_GRID_SIZE = 32
const LINE_COLOR = '#1a2231'
const BG_COLOR = '#0b0f17'

export class GridRenderer {
  /**
   * Why: the grid must redraw every frame the camera moves since every
   * line position is recalculated from the camera's current state.
   * Inputs: ctx, logical CSS pixel width/height, current Camera.
   * Called by: Renderer.draw()
   */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, camera: Camera): void {
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, width, height)

    const center = { x: width / 2, y: height / 2 }
    const topLeft = camera.screenToWorld({ x: 0, y: 0 }, center)
    const bottomRight = camera.screenToWorld({ x: width, y: height }, center)
    const gridSize = this.adaptiveSize(camera.zoom)

    const startX = Math.floor(topLeft.x / gridSize) * gridSize
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize
    const startY = Math.floor(topLeft.y / gridSize) * gridSize
    const endY = Math.ceil(bottomRight.y / gridSize) * gridSize

    ctx.strokeStyle = LINE_COLOR
    ctx.lineWidth = 1
    ctx.beginPath()

    for (let x = startX; x <= endX; x += gridSize) {
      const sx = camera.worldToScreen({ x, y: 0 }, center).x
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, height)
    }

    for (let y = startY; y <= endY; y += gridSize) {
      const sy = camera.worldToScreen({ x: 0, y }, center).y
      ctx.moveTo(0, sy)
      ctx.lineTo(width, sy)
    }

    ctx.stroke()
  }

  private adaptiveSize(zoom: number): number {
    let size = BASE_GRID_SIZE
    while (size * zoom < 16) size *= 2
    while (size * zoom > 128) size /= 2
    return size
  }
}