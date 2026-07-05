// src/engine/history/HistoryManager.ts
// Module 8 fixed — onRecord callback removes circular dependency

import type { HistoryOperation } from './types'

const MAX_HISTORY = 100

export class HistoryManager {
  private undoStack: HistoryOperation[] = []
  private redoStack: HistoryOperation[] = []
  private onRecord?: () => void

  /**
   * Why: instead of scene.ts importing history store (circular),
   * the history store registers a callback here after it initializes.
   * Scene.ts calls historyManager.record() → callback fires → history
   * store syncs its reactive state. Zero circular imports.
   */
  setOnRecord(cb: () => void): void {
    this.onRecord = cb
  }

  record(operation: HistoryOperation): void {
    this.undoStack.push(operation)
    this.redoStack = []
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift()
    this.onRecord?.()
  }

  undo(): string | null {
    const op = this.undoStack.pop()
    if (!op) return null
    op.revert()
    this.redoStack.push(op)
    return op.label
  }

  redo(): string | null {
    const op = this.redoStack.pop()
    if (!op) return null
    op.apply()
    this.undoStack.push(op)
    return op.label
  }

  get canUndo(): boolean { return this.undoStack.length > 0 }
  get canRedo(): boolean { return this.redoStack.length > 0 }
  get undoLabel(): string | null { return this.undoStack.at(-1)?.label ?? null }
  get redoLabel(): string | null { return this.redoStack.at(-1)?.label ?? null }
  get stackSize(): number { return this.undoStack.length }

  clear(): void {
    this.undoStack = []
    this.redoStack = []
  }
}

export const historyManager = new HistoryManager()