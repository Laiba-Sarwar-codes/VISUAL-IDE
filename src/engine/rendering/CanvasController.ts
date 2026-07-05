// src/engine/rendering/CanvasController.ts
// Module 4 — owns event wiring (pointer drag, wheel) and translates raw
// DOM events into Camera method calls.

import { Camera } from './Camera'
import { getRelativeScreenPoint, getViewportCenter, normalizeWheelToZoomFactor } from './coordinates'

export class CanvasController {
  private camera: Camera
  private element: HTMLElement
  private isDragging = false
  private lastPointer: { x: number; y: number } | null = null
  private onChange: (statusMessage?: string) => void

  constructor(element: HTMLElement, camera: Camera, onChange: (statusMessage?: string) => void) {
    this.element = element
    this.camera = camera
    this.onChange = onChange
  }

  attach(): void {
    this.element.addEventListener('pointerdown', this.handlePointerDown)
    window.addEventListener('pointermove', this.handlePointerMove)
    window.addEventListener('pointerup', this.handlePointerUp)
    this.element.addEventListener('wheel', this.handleWheel, { passive: false })
  }

  detach(): void {
    this.element.removeEventListener('pointerdown', this.handlePointerDown)
    window.removeEventListener('pointermove', this.handlePointerMove)
    window.removeEventListener('pointerup', this.handlePointerUp)
    this.element.removeEventListener('wheel', this.handleWheel)
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.isDragging = true
    this.lastPointer = { x: e.clientX, y: e.clientY }
    this.onChange('Panning…')
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.isDragging || !this.lastPointer) return
    const dx = e.clientX - this.lastPointer.x
    const dy = e.clientY - this.lastPointer.y
    this.camera.panByScreenDelta(dx, dy)
    this.lastPointer = { x: e.clientX, y: e.clientY }
    this.onChange('Panning…')
  }

  private handlePointerUp = (): void => {
    if (this.isDragging) this.onChange('Ready')
    this.isDragging = false
    this.lastPointer = null
  }

  /**
   * Why: zoom entry point. Fix vs previous version — screenPoint and
   * viewportCenter are now both computed relative to the canvas's
   * top-left corner and passed to Camera as-is (no manual subtraction).
   * Camera.zoomAtScreenPoint now does that math internally and
   * consistently, so this handler is now a thin, correct translation
   * layer rather than embedding zoom math itself.
   * Inputs: a WheelEvent.
   * Output: none (mutates camera, triggers onChange).
   * Called by: the browser, on every wheel event over the canvas.
   */
  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault() // stop page scroll from hijacking the gesture

    const rect = this.element.getBoundingClientRect()
    const screenPoint = getRelativeScreenPoint(e.clientX, e.clientY, rect)
    const viewportCenter = getViewportCenter(rect)
    const factor = normalizeWheelToZoomFactor(e.deltaY)

    this.camera.zoomAtScreenPoint(screenPoint, viewportCenter, factor)

    this.onChange(`Zoom: ${Math.round(this.camera.zoom * 100)}%`)
  }
}