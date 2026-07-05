// src/engine/rendering/Renderer.ts
// Module 12 — added snap guide line rendering

import { GridRenderer } from './GridRenderer'
import { ShapeRenderer } from './ShapeRenderer'
import { RenderLoop } from './RenderLoop'
import { getVisibleObjects } from '../performance/culling'
import { PerformanceMonitor } from '../performance/PerformanceMonitor'
import { drawSnapGuides } from './SnapGuides'
import type { GuideLine } from './SnapGuides'
import type { Camera } from './Camera'
import type { SceneObject } from '../scene-graph/types'
import type { Asset } from '../../storage/binary/types'

export interface RenderState {
  objects: SceneObject[]
  // Kept for back-compat — a single-object caller can still just set this.
  selectedObject: SceneObject | null
  // Layer Management: multi-select highlighting. When present (non-empty),
  // takes precedence over selectedObject for what gets drawn.
  selectedObjects?: SceneObject[]
  camera: Camera
  guideLines?: GuideLine[]
}

export class Renderer {
  private ctx: CanvasRenderingContext2D | null = null
  private cssWidth = 0
  private cssHeight = 0

  private grid = new GridRenderer()
  private shapes = new ShapeRenderer()
  private loop: RenderLoop
  readonly perf = new PerformanceMonitor()

  private state: RenderState = {
    objects: [],
    selectedObject: null,
    camera: null as unknown as Camera,
    guideLines: [],
  }

  constructor() {
    this.loop = new RenderLoop(() => this.draw())
  }

  mount(canvas: HTMLCanvasElement): void {
    this.ctx = canvas.getContext('2d')
    this.loop.start()
    this.loop.markDirty()
  }

  unmount(): void { this.loop.stop() }

  resize(canvas: HTMLCanvasElement, container: HTMLElement): void {
    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.cssWidth = rect.width
    this.cssHeight = rect.height
    canvas.width = this.cssWidth * dpr
    canvas.height = this.cssHeight * dpr
    canvas.style.width = `${this.cssWidth}px`
    canvas.style.height = `${this.cssHeight}px`
    this.ctx = canvas.getContext('2d')
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.loop.markDirty()
  }

  update(state: Partial<RenderState>): void {
    Object.assign(this.state, state)
    this.loop.markDirty()
  }

  markDirty(): void { this.loop.markDirty() }

  setAssets(assets: Asset[]): void {
    const map = new Map<string, HTMLImageElement>()
    for (const asset of assets) {
      const img = new Image()
      img.src = asset.objectUrl
      img.onload = () => this.loop.markDirty()
      map.set(asset.id, img)
    }
    this.shapes.setImages(map)
    this.loop.markDirty()
  }

  private draw(): void {
    const { ctx, cssWidth, cssHeight, state } = this
    if (!ctx || !state.camera) return

    const endTimer = this.perf.renderStart()
    const culled = getVisibleObjects(state.objects, state.camera, cssWidth, cssHeight)
    this.perf.recordCulling(state.objects.length, culled.length)
    const visibleIds = new Set(culled.map(o => o.id))

    this.grid.draw(ctx, cssWidth, cssHeight, state.camera)
    this.shapes.drawObjects(ctx, cssWidth, cssHeight, state.camera, state.objects, visibleIds)

    const selection = state.selectedObjects && state.selectedObjects.length > 0
      ? state.selectedObjects
      : (state.selectedObject ? [state.selectedObject] : [])
    for (const obj of selection) {
      this.shapes.drawSelection(ctx, cssWidth, cssHeight, state.camera, obj)
    }

    // Snap guide lines drawn on top of everything
    if (state.guideLines && state.guideLines.length > 0) {
      drawSnapGuides(ctx, state.guideLines, state.camera, cssWidth, cssHeight)
    }

    endTimer()
  }
}