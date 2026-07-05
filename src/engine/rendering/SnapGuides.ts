// src/engine/rendering/SnapGuides.ts
// Snap guides — grid snap + object-edge snap during drag

import type { SceneObject } from '../scene-graph/types'
import type { Camera } from './Camera'

export interface GuideLine {
  axis: 'x' | 'y'
  value: number  // world coordinate of the guide line
}

export interface SnapResult {
  x: number
  y: number
  guideLines: GuideLine[]
}

const SNAP_THRESHOLD_PX = 8  // screen pixels — scales with zoom
const GRID_SIZE = 32          // world units, matches GridRenderer

function worldThreshold(zoom: number): number {
  return SNAP_THRESHOLD_PX / zoom
}

function gridCandidates(value: number): number[] {
  const base = Math.round(value / GRID_SIZE) * GRID_SIZE
  return [base - GRID_SIZE, base, base + GRID_SIZE]
}

function objectCandidates(
  objects: SceneObject[],
  excludeId: string
): { xs: number[]; ys: number[] } {
  const xs: number[] = []
  const ys: number[] = []
  for (const obj of objects) {
    if (obj.id === excludeId || !obj.visible) continue
    xs.push(obj.x, obj.x + obj.width / 2, obj.x + obj.width)
    ys.push(obj.y, obj.y + obj.height / 2, obj.y + obj.height)
  }
  return { xs, ys }
}

function nearestSnap(
  value: number,
  candidates: number[],
  threshold: number
): { snapped: number; hit: boolean } {
  let best = Infinity
  let snapped = value
  for (const c of candidates) {
    const d = Math.abs(value - c)
    if (d < threshold && d < best) { best = d; snapped = c }
  }
  return { snapped, hit: best < Infinity }
}

/**
 * Computes snapped position and guide lines for the dragged object.
 *
 * Priority per axis: left/top edge → center → right/bottom edge.
 * First match wins — avoids multiple conflicting snaps on same axis.
 *
 * Inputs:
 *   dragged    — object at its RAW (pre-snap) drag position
 *   allObjects — full scene list (provides snap targets)
 *   zoom       — camera zoom (converts threshold from px to world)
 *
 * Output: snapped { x, y } and guideLines to render.
 */
export function computeSnap(
  dragged: SceneObject,
  allObjects: SceneObject[],
  zoom: number
): SnapResult {
  const t = worldThreshold(zoom)
  const grid = gridCandidates
  const { xs: oXs, ys: oYs } = objectCandidates(allObjects, dragged.id)

  const xCandidates = [...grid(dragged.x), ...oXs]
  const yCandidates = [...grid(dragged.y), ...oYs]

  let finalX = dragged.x
  let finalY = dragged.y
  const guideLines: GuideLine[] = []

  // X: try left edge, then center, then right edge
  const snapLeft  = nearestSnap(dragged.x,                         xCandidates, t)
  const snapCX    = nearestSnap(dragged.x + dragged.width / 2,     xCandidates, t)
  const snapRight = nearestSnap(dragged.x + dragged.width,         xCandidates, t)

  if (snapLeft.hit) {
    finalX = snapLeft.snapped
    guideLines.push({ axis: 'x', value: snapLeft.snapped })
  } else if (snapCX.hit) {
    finalX = snapCX.snapped - dragged.width / 2
    guideLines.push({ axis: 'x', value: snapCX.snapped })
  } else if (snapRight.hit) {
    finalX = snapRight.snapped - dragged.width
    guideLines.push({ axis: 'x', value: snapRight.snapped })
  }

  // Y: try top edge, then center, then bottom edge
  const snapTop    = nearestSnap(dragged.y,                          yCandidates, t)
  const snapCY     = nearestSnap(dragged.y + dragged.height / 2,    yCandidates, t)
  const snapBottom = nearestSnap(dragged.y + dragged.height,         yCandidates, t)

  if (snapTop.hit) {
    finalY = snapTop.snapped
    guideLines.push({ axis: 'y', value: snapTop.snapped })
  } else if (snapCY.hit) {
    finalY = snapCY.snapped - dragged.height / 2
    guideLines.push({ axis: 'y', value: snapCY.snapped })
  } else if (snapBottom.hit) {
    finalY = snapBottom.snapped - dragged.height
    guideLines.push({ axis: 'y', value: snapBottom.snapped })
  }

  return { x: finalX, y: finalY, guideLines }
}

/**
 * Draws guide lines on top of all canvas content.
 * Called by Renderer.draw() when guideLines array is non-empty.
 */
export function drawSnapGuides(
  ctx: CanvasRenderingContext2D,
  guideLines: GuideLine[],
  camera: Camera,
  cssWidth: number,
  cssHeight: number
): void {
  if (guideLines.length === 0) return

  const center = { x: cssWidth / 2, y: cssHeight / 2 }
  ctx.save()
  ctx.strokeStyle = '#7c83ff'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.globalAlpha = 0.9

  for (const g of guideLines) {
    ctx.beginPath()
    if (g.axis === 'x') {
      const sx = camera.worldToScreen({ x: g.value, y: 0 }, center).x
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, cssHeight)
    } else {
      const sy = camera.worldToScreen({ x: 0, y: g.value }, center).y
      ctx.moveTo(0, sy)
      ctx.lineTo(cssWidth, sy)
    }
    ctx.stroke()
  }

  ctx.setLineDash([])
  ctx.globalAlpha = 1
  ctx.restore()
}