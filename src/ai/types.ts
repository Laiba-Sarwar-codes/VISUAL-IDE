// src/ai/types.ts
// Module 19 — AI Workflow type definitions

export type AIIntent =
  | 'create'
  | 'delete'
  | 'modify'
  | 'center'
  | 'unknown'

export type AIShapeType = 'rectangle' | 'ellipse' | 'text'

export interface ParsedInstruction {
  intent: AIIntent
  shapeType?: AIShapeType
  count?: number
  color?: string
  text?: string
  target?: 'selected' | 'all' | 'all-rectangles' | 'all-ellipses' | 'all-text'
  property?: string
  value?: string | number
  raw: string
}

export type AIOperationType =
  | 'create-shape'
  | 'delete-selected'
  | 'modify-color'
  | 'modify-opacity'
  | 'center-objects'

export interface AIOperation {
  type: AIOperationType
  payload: Record<string, unknown>
  description: string
}

export interface AIWorkflowResult {
  success: boolean
  instruction: string
  parsed: ParsedInstruction
  operations: AIOperation[]
  message: string
}