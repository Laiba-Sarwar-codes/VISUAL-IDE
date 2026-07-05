// src/engine/history/types.ts
// Module 8 — history operation type definitions

export type HistoryOperationType =
  | 'object:create'
  | 'object:delete'
  | 'object:move'
  | 'object:opacity'
  | 'object:visibility'
  | 'object:lock'
  | 'object:reorder'
  | 'object:blendMode'
  | 'layer:createFolder'
  | 'layer:renameNode'
  | 'layer:deleteFolder'
  | 'layer:reparent'
  | 'layer:group'
  | 'layer:ungroup'
  | 'layer:align'
  | 'layer:distribute'

export interface HistoryOperation {
  id: string
  type: HistoryOperationType
  timestamp: number
  label: string          // human-readable e.g. "Move Rectangle 1"

  // Snapshots of the affected state before and after the operation.
  // Typed as unknown here so each operation type can store exactly
  // what it needs (a full SceneObject, a zIndex array, etc.)
  // without forcing a union type on the interface itself.
  before: unknown
  after: unknown

  /**
   * Why: apply re-executes the operation — used by redo to move
   * forward through history. Keeping apply/revert as functions on the
   * operation itself means HistoryManager never needs to know the
   * internals of any specific operation type.
   */
  apply: () => void

  /**
   * Why: revert undoes the operation — used by undo to move backward.
   * Same reasoning as apply.
   */
  revert: () => void
}