// src/engine/rendering/ShapeRenderer.ts
// Module 12 — adds image/svg rendering
// Layer Management — paint order is now the hierarchy-aware DFS from
// LayerTreeService (folders/groups are never drawn directly; a group
// occupies one z-slot among its siblings and its children paint inside
// that slot), with ancestor-resolved effective opacity/blend-mode.

import { buildPaintOrder, getEffectiveBlendMode, getEffectiveOpacity, getEffectiveVisibility } from '../../layers/LayerTreeService'
import { resolveCompositeOperation } from '../../layers/types'
import type { Camera } from './Camera'
import type { SceneObject } from '../scene-graph/types'

const SELECTION_COLOR = '#3b82f6'
const HANDLE_SIZE = 8

export class ShapeRenderer {
  // Pre-loaded image elements keyed by assetId — updated by Renderer.setImages()
  private images: Map<string, HTMLImageElement> = new Map()

  /**
   * Why: the draw loop is synchronous. Images must be pre-loaded into
   * HTMLImageElement objects before the frame renders, not during it.
   * Renderer.update() calls this whenever the asset store changes.
   */
  setImages(images: Map<string, HTMLImageElement>): void {
    this.images = images
  }

  /**
   * @param objects - the FULL scene (not viewport-culled) so ancestor
   * chains (for effective visibility/opacity/blend-mode) resolve
   * correctly even when a parent's own bbox falls outside the viewport.
   * @param visibleIds - viewport-culled leaf ids (perf only); ancestor
   * boolean visibility is independent of on-screen bounds.
   */
  drawObjects(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: Camera,
    objects: SceneObject[],
    visibleIds: Set<string>
  ): void {
    const center = { x: width / 2, y: height / 2 }
    const byId = new Map(objects.map(o => [o.id, o]))
    const paintOrder = buildPaintOrder(objects)

    for (const id of paintOrder) {
      if (!visibleIds.has(id)) continue
      const obj = byId.get(id)
      if (!obj) continue
      if (!getEffectiveVisibility(objects, id)) continue

      const pos = camera.worldToScreen({ x: obj.x, y: obj.y }, center)
      const w = obj.width * camera.zoom
      const h = obj.height * camera.zoom

      ctx.save()
      ctx.globalAlpha = getEffectiveOpacity(objects, id)
      ctx.globalCompositeOperation = resolveCompositeOperation(getEffectiveBlendMode(objects, id))

      if (obj.rotation !== 0) {
        const cx = pos.x + w / 2
        const cy = pos.y + h / 2
        ctx.translate(cx, cy)
        ctx.rotate((obj.rotation * Math.PI) / 180)
        ctx.translate(-cx, -cy)
      }

      switch (obj.type) {
        case 'rectangle': this.drawRect(ctx, pos.x, pos.y, w, h, obj); break
        case 'ellipse':   this.drawEllipse(ctx, pos.x, pos.y, w, h, obj); break
        case 'text':      this.drawText(ctx, pos.x, pos.y, w, h, camera.zoom, obj); break
        case 'image':     this.drawImage(ctx, pos.x, pos.y, w, h, obj); break
      }

      ctx.restore()
    }
  }

  drawSelection(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: Camera,
    obj: SceneObject
  ): void {
    const center = { x: width / 2, y: height / 2 }
    const pos = camera.worldToScreen({ x: obj.x, y: obj.y }, center)
    const w = obj.width * camera.zoom
    const h = obj.height * camera.zoom

    ctx.save()
    ctx.strokeStyle = SELECTION_COLOR
    ctx.lineWidth = 2
    ctx.strokeRect(pos.x - 1, pos.y - 1, w + 2, h + 2)

    const corners = [
      { x: pos.x,     y: pos.y },
      { x: pos.x + w, y: pos.y },
      { x: pos.x,     y: pos.y + h },
      { x: pos.x + w, y: pos.y + h },
    ]
    for (const c of corners) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(c.x - HANDLE_SIZE / 2, c.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
      ctx.strokeRect(c.x - HANDLE_SIZE / 2, c.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
    }
    ctx.restore()
  }

  /**
   * Why: draws a pre-loaded HTMLImageElement at the object's screen
   * position. Falls back to a placeholder rectangle if the image hasn't
   * loaded yet or assetId is missing.
   */
  private drawImage(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    w: number, h: number,
    obj: SceneObject
  ): void {
    const img = obj.assetId ? this.images.get(obj.assetId) : undefined
    if (img) {
      ctx.drawImage(img, x, y, w, h)
    } else {
      // Placeholder until image loads
      ctx.fillStyle = '#2a2a2a'
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#555'
      ctx.font = '12px monospace'
      ctx.textBaseline = 'middle'
      ctx.fillText('⏳ Loading…', x + 8, y + h / 2)
    }
  }

  private drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, obj: SceneObject): void {
    ctx.fillStyle = obj.fill
    ctx.fillRect(x, y, w, h)
    if (obj.stroke && obj.stroke !== 'transparent') {
      ctx.strokeStyle = obj.stroke
      ctx.lineWidth = 1.5
      ctx.strokeRect(x, y, w, h)
    }
  }

  private drawEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, obj: SceneObject): void {
    ctx.beginPath()
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    ctx.fillStyle = obj.fill
    ctx.fill()
    if (obj.stroke && obj.stroke !== 'transparent') {
      ctx.strokeStyle = obj.stroke
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  private drawText(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, zoom: number, obj: SceneObject): void {
    const fontSize = Math.max(8, 14 * zoom)
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.fillStyle = obj.fill === 'transparent' ? '#ffffff' : obj.fill
    ctx.textBaseline = 'top'
    ctx.save()
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    ctx.clip()
    ctx.fillText(obj.text ?? 'Text', x, y)
    ctx.restore()
  }
}