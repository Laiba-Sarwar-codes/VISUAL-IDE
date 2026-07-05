// src/ai/planTypes.ts
// AI Workflow — structured plan schema for the rich, multi-step,
// validated pipeline (parser -> reference resolver -> plan builder ->
// validator -> executor). Named `AIPlanOperation` rather than `AIOperation`
// to avoid colliding with the pre-existing, differently-shaped `AIOperation`
// in `src/ai/types.ts`, which stays completely untouched and still backs
// the original create/delete/modify-color/modify-opacity/center pipeline
// (AIWorkflowService/InstructionParser/OperationGenerator/OperationExecutor)
// for full backward compatibility.

import type { SceneObjectType } from '../engine/scene-graph/types'
import type { BlendMode } from '../layers/types'

/** Refers to either a concrete existing object id, or a temp ref produced by an earlier step in the same plan (see BaseAIOperation.resultRef). */
export interface AITargetRef {
  objectId?: string
  ref?: string
}

export interface BaseAIOperation {
  id: string
  type: string
  description?: string
  /** Registers this operation's resulting object under a name later operations in the same plan can target via `target.ref`/`targets[].ref`. */
  resultRef?: string
}

export interface CreateObjectOperation extends BaseAIOperation {
  type: 'create-object'
  objectType: SceneObjectType
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  stroke?: string
  text?: string
  name?: string
}

export interface UpdateObjectOperation extends BaseAIOperation {
  type: 'update-object'
  target: AITargetRef
  changes: Partial<{
    fill: string
    stroke: string
    text: string
    name: string
    width: number
    height: number
    rotation: number
  }>
}

export interface DeleteObjectOperation extends BaseAIOperation {
  type: 'delete-object'
  targets: AITargetRef[]
}

export interface MoveObjectOperation extends BaseAIOperation {
  type: 'move-object'
  target: AITargetRef
  toCenter?: boolean
  x?: number
  y?: number
  relative?: boolean
  anchor?: AITargetRef
  anchorDirection?: 'above' | 'below' | 'left-of' | 'right-of'
  gap?: number
}

export interface ResizeObjectOperation extends BaseAIOperation {
  type: 'resize-object'
  target: AITargetRef
  width?: number
  height?: number
  relative?: boolean
}

export interface RotateObjectOperation extends BaseAIOperation {
  type: 'rotate-object'
  target: AITargetRef
  degrees: number
  relative?: boolean
}

export interface DuplicateObjectOperation extends BaseAIOperation {
  type: 'duplicate-object'
  targets: AITargetRef[]
  offsetX?: number
  offsetY?: number
}

export interface AlignObjectsOperation extends BaseAIOperation {
  type: 'align-objects'
  targets: AITargetRef[]
  edge: 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter'
}

export interface DistributeObjectsOperation extends BaseAIOperation {
  type: 'distribute-objects'
  targets: AITargetRef[]
  axis: 'horizontal' | 'vertical'
}

export interface GroupObjectsOperation extends BaseAIOperation {
  type: 'group-objects'
  targets: AITargetRef[]
}

export interface UngroupObjectsOperation extends BaseAIOperation {
  type: 'ungroup-objects'
  target: AITargetRef
}

export interface ReorderObjectOperation extends BaseAIOperation {
  type: 'reorder-object'
  target: AITargetRef
  direction: 'front' | 'forward' | 'backward' | 'back'
}

export interface SetVisibilityOperation extends BaseAIOperation {
  type: 'set-visibility'
  targets: AITargetRef[]
  visible: boolean
}

export interface SetLockOperation extends BaseAIOperation {
  type: 'set-lock'
  targets: AITargetRef[]
  locked: boolean
}

export interface SetOpacityOperation extends BaseAIOperation {
  type: 'set-opacity'
  targets: AITargetRef[]
  opacity: number
}

export interface SetBlendModeOperation extends BaseAIOperation {
  type: 'set-blend-mode'
  targets: AITargetRef[]
  blendMode: BlendMode
}

export interface SelectObjectsOperation extends BaseAIOperation {
  type: 'select-objects'
  targets: AITargetRef[]
}

export interface RenameObjectOperation extends BaseAIOperation {
  type: 'rename-object'
  target: AITargetRef
  name: string
}

export type AIPlanOperation =
  | CreateObjectOperation
  | UpdateObjectOperation
  | DeleteObjectOperation
  | MoveObjectOperation
  | ResizeObjectOperation
  | RotateObjectOperation
  | DuplicateObjectOperation
  | AlignObjectsOperation
  | DistributeObjectsOperation
  | GroupObjectsOperation
  | UngroupObjectsOperation
  | ReorderObjectOperation
  | SetVisibilityOperation
  | SetLockOperation
  | SetOpacityOperation
  | SetBlendModeOperation
  | SelectObjectsOperation
  | RenameObjectOperation

export interface AIExecutionPlan {
  id: string
  originalPrompt: string
  summary: string
  operations: AIPlanOperation[]
  warnings: string[]
  requiresConfirmation: boolean
  createdAt: number
}

export interface AIValidationError {
  operationId?: string
  code: string
  message: string
  recoverable: boolean
}

/** One object's minimal, read-only, JSON-serializable projection — never a live store reference. */
export interface AIContextObject {
  id: string
  type: SceneObjectType
  name: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  visible: boolean
  locked: boolean
  opacity: number
  blendMode?: BlendMode
  parentId: string | null
}

export interface AIEditorContext {
  objects: AIContextObject[]
  selectedObjectIds: string[]
  viewport: { left: number; top: number; right: number; bottom: number }
  supportedObjectTypes: SceneObjectType[]
  supportedBlendModes: BlendMode[]
  supportedOperationTypes: string[]
}

export interface AIWorkerRequest {
  id: string
  prompt: string
  context: AIEditorContext
}

export interface AIWorkerResponse {
  id: string
  success: boolean
  plan?: AIExecutionPlan
  error?: string
  durationMs: number
}

export interface AIExecutionResult {
  planId: string
  success: boolean
  executedOperationCount: number
  affectedObjectIds: string[]
  createdObjectIds: string[]
  warnings: string[]
  durationMs: number
  error?: string
}

/**
 * Injectable so AIOperationExecutor is unit-testable without a full Nuxt
 * runtime. The real implementation wraps PersistentHistoryService (the
 * service that actually drives Cmd+Z — see AIOperationExecutor.ts).
 */
export interface AITransactionAdapter {
  begin(label: string): void
  updateSnapshot(): void
  commit(): Promise<void>
  cancel(): void
}

/** Intermediate output of AIPromptParser — one instruction step, before reference resolution / operation generation. */
export interface ParsedStep {
  raw: string
  intent:
    | 'create'
    | 'delete'
    | 'set-color'
    | 'set-opacity'
    | 'set-blend-mode'
    | 'move'
    | 'resize'
    | 'rotate'
    | 'duplicate'
    | 'align'
    | 'distribute'
    | 'group'
    | 'ungroup'
    | 'reorder'
    | 'set-visibility'
    | 'set-lock'
    | 'rename'
    | 'select'
    | 'unknown'
  /** Whole step text — the reference resolver extracts the actual target(s) from this rather than the parser pre-carving a substring. */
  referencePhrase: string
  objectType?: SceneObjectType
  count?: number
  color?: string
  text?: string
  newName?: string
  opacityValue?: number
  blendMode?: BlendMode
  edge?: AlignObjectsOperation['edge']
  axis?: DistributeObjectsOperation['axis']
  direction?: ReorderObjectOperation['direction']
  visibilityValue?: boolean
  lockValue?: boolean
  resizeProperty?: 'width' | 'height'
  resizeDelta?: number
  resizeRelative?: boolean
  rotateDegrees?: number
  moveMode?: 'center' | 'delta' | 'relative-anchor'
  moveDx?: number
  moveDy?: number
  anchorPhrase?: string
  anchorDirection?: 'above' | 'below' | 'left-of' | 'right-of'
}
