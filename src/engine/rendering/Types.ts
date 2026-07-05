// src/engine/rendering/Types.ts
// Module 4 — shared types for the viewport/camera system

/** A point in screen space (pixels, relative to the canvas element's top-left corner) */
export interface ScreenPoint {
  x: number
  y: number
}

/** A point in world space (the infinite, zoom/pan-independent coordinate space) */
export interface WorldPoint {
  x: number
  y: number
}

/** Camera state: where the viewport is looking, and how zoomed in it is */
export interface CameraState {
  x: number
  y: number
  zoom: number
}

export interface CameraLimits {
  minZoom: number
  maxZoom: number
}