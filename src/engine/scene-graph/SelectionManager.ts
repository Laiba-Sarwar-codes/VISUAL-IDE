// src/engine/scene-graph/SelectionManager.ts
// Module 6 — tracks selection and drag interaction state
// V1: Lock guard prevents drag start for locked objects

import type { SceneObject } from './types'

export interface DragState {
  isDragging: boolean
  startWorldX: number
  startWorldY: number
  objectStartX: number
  objectStartY: number
}

export class SelectionManager {
  selectedId: string | null = null

  drag: DragState = {
    isDragging: false,
    startWorldX: 0,
    startWorldY: 0,
    objectStartX: 0,
    objectStartY: 0,
  }

  select(obj: SceneObject | null): void {
    this.selectedId = obj?.id ?? null
    this.drag.isDragging = false
  }

  /**
   * Why: locked objects may be selected but MUST NOT be dragged.
   * The lock check lives here in the shared interaction layer, not
   * in the Vue template, so any future drag source also respects it.
   * Inputs: world-space pointer position; the object being dragged.
   * Returns: true if drag was started, false if object is locked.
   */
  startDrag(worldX: number, worldY: number, obj: SceneObject): boolean {
    if (obj.locked) {
      // Do not start a drag for locked objects
      return false
    }
    this.drag = {
      isDragging: true,
      startWorldX: worldX,
      startWorldY: worldY,
      objectStartX: obj.x,
      objectStartY: obj.y,
    }
    return true
  }

  computeDragPosition(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: this.drag.objectStartX + (worldX - this.drag.startWorldX),
      y: this.drag.objectStartY + (worldY - this.drag.startWorldY),
    }
  }

  endDrag(): void {
    this.drag.isDragging = false
  }

  get hasSelection(): boolean {
    return this.selectedId !== null
  }
}
