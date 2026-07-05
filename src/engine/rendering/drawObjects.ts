// src/engine/rendering/drawObjects.ts
// Module 5 — renders scene objects onto the canvas using camera transform

import type { Camera } from './Camera'
import type { SceneObject } from '../scene-graph/types'

/**
 * Why: the renderer needs to convert every object's world-space position
 * and size into screen-space pixels before drawing. This function handles
 * that for all object types in one place so CanvasWorkspace.vue stays clean.
 * Inputs: ctx — 2D context; cssWidth/cssHeight — logical canvas dimensions;
 *         camera — current camera state; objects — sorted scene objects.
 * Output: none (draws onto ctx).
 * Called by: CanvasWorkspace's render function, after drawGrid.
 */
export function drawObjects(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  camera: Camera,
  objects: SceneObject[]
): void {
  const center = { x: cssWidth / 2, y: cssHeight / 2 }

  for (const obj of objects) {
    if (!obj.visible) continue

    // Convert world-space top-left corner to screen-space
    const screenPos = camera.worldToScreen({ x: obj.x, y: obj.y }, center)

    // Scale world-space dimensions to screen-space
    const screenWidth = obj.width * camera.zoom
    const screenHeight = obj.height * camera.zoom

    ctx.save()
    ctx.globalAlpha = obj.opacity

    // Apply rotation around the object's center
    if (obj.rotation !== 0) {
      const cx = screenPos.x + screenWidth / 2
      const cy = screenPos.y + screenHeight / 2
      ctx.translate(cx, cy)
      ctx.rotate((obj.rotation * Math.PI) / 180)
      ctx.translate(-cx, -cy)
    }

    switch (obj.type) {
      case 'rectangle':
        drawRectangle(ctx, screenPos.x, screenPos.y, screenWidth, screenHeight, obj)
        break
      case 'ellipse':
        drawEllipse(ctx, screenPos.x, screenPos.y, screenWidth, screenHeight, obj)
        break
      case 'text':
        drawText(ctx, screenPos.x, screenPos.y, screenWidth, camera.zoom, obj)
        break
    }

    ctx.restore()
  }
}

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  obj: SceneObject
): void {
  ctx.fillStyle = obj.fill
  ctx.fillRect(x, y, w, h)
  if (obj.stroke && obj.stroke !== 'transparent') {
    ctx.strokeStyle = obj.stroke
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, w, h)
  }
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  obj: SceneObject
): void {
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.beginPath()
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fillStyle = obj.fill
  ctx.fill()
  if (obj.stroke && obj.stroke !== 'transparent') {
    ctx.strokeStyle = obj.stroke
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number,
  zoom: number,
  obj: SceneObject
): void {
  const fontSize = Math.max(8, 14 * zoom)
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
  ctx.fillStyle = obj.fill === 'transparent' ? '#ffffff' : obj.fill
  ctx.textBaseline = 'top'

  // Clip text to its bounding box width
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, obj.height * zoom)
  ctx.clip()
  ctx.fillText(obj.text ?? 'Text', x, y)
  ctx.restore()
}