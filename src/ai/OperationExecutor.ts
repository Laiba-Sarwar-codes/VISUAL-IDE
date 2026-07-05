// src/ai/OperationExecutor.ts
// Module 19 — applies AI operations to the scene store

import { useSceneStore } from '../../app/stores/scene'
import { useSelectionStore } from '../../app/stores/selection'
import type { AIOperation } from './types'

export interface ExecutionResult {
  success: boolean
  message: string
}

/**
 * Why: executes one AIOperation at a time and returns a result so the
 * caller (AI store) can report success/failure per operation without
 * crashing on a bad operation type.
 * Inputs: a single AIOperation.
 * Output: ExecutionResult with success flag and message.
 * Called by: AI Pinia store's execute action.
 */
export function executeOperation(op: AIOperation): ExecutionResult {
  try {
    switch (op.type) {
      case 'create-shape':
        return executeCreateShape(op)
      case 'delete-selected':
        return executeDeleteSelected()
      case 'modify-color':
        return executeModifyColor(op)
      case 'modify-opacity':
        return executeModifyOpacity(op)
      case 'center-objects':
        return executeCenterObjects(op)
      default:
        return { success: false, message: `Unknown operation type: ${op.type}` }
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Operation failed',
    }
  }
}

function executeCreateShape(op: AIOperation): ExecutionResult {
  const scene = useSceneStore()
  const { shapeType, x, y, fill, text } = op.payload as {
    shapeType: 'rectangle' | 'ellipse' | 'text'
    x: number
    y: number
    fill: string
    text?: string
  }

  scene.addObject({ type: shapeType, x, y, fill, text })
  return { success: true, message: `Created ${shapeType}` }
}

function executeDeleteSelected(): ExecutionResult {
  const selection = useSelectionStore()
  if (!selection.selectedId) {
    return { success: false, message: 'No object selected to delete.' }
  }
  selection.deleteSelected()
  return { success: true, message: 'Deleted selected object' }
}

function executeModifyColor(op: AIOperation): ExecutionResult {
  const scene = useSceneStore()
  const selection = useSelectionStore()
  const { color, target } = op.payload as { color: string; target: string }

  if (target === 'selected') {
    if (!selection.selectedId) {
      return { success: false, message: 'No object selected. Click a shape first.' }
    }
    scene.updateObject(selection.selectedId, { fill: color })
    return { success: true, message: `Changed color to ${color}` }
  }

  // Apply to filtered objects based on target
  const objects = scene.objects.filter(obj => {
    if (target === 'all') return true
    if (target === 'all-rectangles') return obj.type === 'rectangle'
    if (target === 'all-ellipses') return obj.type === 'ellipse'
    if (target === 'all-text') return obj.type === 'text'
    return false
  })

  objects.forEach(obj => scene.updateObject(obj.id, { fill: color }))
  return { success: true, message: `Changed color to ${color} for ${objects.length} objects` }
}

function executeModifyOpacity(op: AIOperation): ExecutionResult {
  const scene = useSceneStore()
  const selection = useSelectionStore()
  const { opacity, target } = op.payload as { opacity: number; target: string }

  if (target === 'selected') {
    if (!selection.selectedId) {
      return { success: false, message: 'No object selected.' }
    }
    scene.setOpacity(selection.selectedId, opacity)
    return { success: true, message: `Set opacity to ${Math.round(opacity * 100)}%` }
  }

  scene.objects.forEach(obj => scene.setOpacity(obj.id, opacity))
  return { success: true, message: `Set opacity to ${Math.round(opacity * 100)}% for all objects` }
}

function executeCenterObjects(op: AIOperation): ExecutionResult {
  const scene = useSceneStore()
  const { target } = op.payload as { target: string }

  const objects = target === 'all'
    ? scene.objects
    : scene.objects.filter(o => o.type === target.replace('all-', ''))

  if (objects.length === 0) {
    return { success: false, message: 'No objects to center.' }
  }

  objects.forEach(obj => scene.updateObject(obj.id, { x: 0, y: 0 }))
  return { success: true, message: `Centered ${objects.length} objects` }
}