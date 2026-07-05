// src/ai/AIPlanValidator.ts
// AI Workflow — validates a built AIExecutionPlan before it is ever
// allowed to execute. Kept separate from both parsing (AIPromptParser)
// and execution (AIOperationExecutor) per the "keep validation separate"
// architecture rule. Never mutates anything — pure inspection.
//
// `recoverable: true` errors are informational (surfaced in the preview,
// don't block execution — e.g. "fewer than the ideal object count",
// "target is locked" which the plan already flags for confirmation).
// `recoverable: false` errors always block execution entirely.

import { BLEND_MODES } from '../layers/types'
import { SUPPORTED_OPERATION_TYPES } from './AIContextBuilder'
import type { AIEditorContext, AIExecutionPlan, AIPlanOperation, AITargetRef, AIValidationError } from './planTypes'

function targetExists(ref: AITargetRef, context: AIEditorContext, knownRefs: Set<string>): boolean {
  if (ref.ref) return knownRefs.has(ref.ref)
  if (ref.objectId) return context.objects.some(o => o.id === ref.objectId)
  return false
}

function isLocked(ref: AITargetRef, context: AIEditorContext): boolean {
  if (!ref.objectId) return false
  return context.objects.find(o => o.id === ref.objectId)?.locked ?? false
}

function collectTargets(op: AIPlanOperation): AITargetRef[] {
  if ('targets' in op) return op.targets
  if ('target' in op) return [op.target]
  return []
}

export function validatePlan(plan: AIExecutionPlan, context: AIEditorContext): AIValidationError[] {
  const errors: AIValidationError[] = []
  const knownRefs = new Set<string>()

  for (const op of plan.operations) {
    if (!SUPPORTED_OPERATION_TYPES.includes(op.type)) {
      errors.push({ operationId: op.id, code: 'UNSUPPORTED_OPERATION', message: `Unsupported operation type: ${op.type}`, recoverable: false })
      continue
    }

    // Operations that declare a targets/target field but resolved to zero
    // objects (e.g. "delete the second circle" when none exist) must be
    // caught here, not left to throw at execution time — 'create-object'
    // legitimately has neither field since it doesn't target anything.
    const hasTargetField = 'targets' in op || 'target' in op
    const targets = collectTargets(op)
    if (hasTargetField && targets.length === 0) {
      errors.push({ operationId: op.id, code: 'NO_TARGETS_RESOLVED', message: 'No matching object was found for this operation.', recoverable: false })
    }

    for (const t of targets) {
      if (!t.objectId && !t.ref) {
        errors.push({ operationId: op.id, code: 'MISSING_TARGET', message: 'Operation is missing a target reference.', recoverable: false })
        continue
      }
      if (!targetExists(t, context, knownRefs)) {
        errors.push({
          operationId: op.id, code: 'TARGET_NOT_FOUND',
          message: `Target ${t.objectId ? `object "${t.objectId}"` : `reference "${t.ref}"`} does not exist.`,
          recoverable: false,
        })
      } else if (isLocked(t, context) && op.type !== 'set-lock') {
        errors.push({
          operationId: op.id, code: 'LOCKED_TARGET',
          message: 'Target object is locked — unlock it first or confirm this change.',
          recoverable: true,
        })
      }
    }

    switch (op.type) {
      case 'create-object':
        if (!context.supportedObjectTypes.includes(op.objectType)) {
          errors.push({ operationId: op.id, code: 'UNSUPPORTED_OBJECT_TYPE', message: `Unsupported object type: ${op.objectType}`, recoverable: false })
        }
        if (op.width !== undefined && (!Number.isFinite(op.width) || op.width < 0)) {
          errors.push({ operationId: op.id, code: 'INVALID_DIMENSION', message: 'Width must be a non-negative finite number.', recoverable: false })
        }
        if (op.height !== undefined && (!Number.isFinite(op.height) || op.height < 0)) {
          errors.push({ operationId: op.id, code: 'INVALID_DIMENSION', message: 'Height must be a non-negative finite number.', recoverable: false })
        }
        if (op.resultRef) knownRefs.add(op.resultRef)
        break

      case 'duplicate-object':
        if (op.resultRef) knownRefs.add(op.resultRef)
        break

      case 'group-objects':
        if (op.resultRef) knownRefs.add(op.resultRef)
        if (op.targets.length < 2) {
          errors.push({ operationId: op.id, code: 'INSUFFICIENT_SELECTION', message: 'Group requires at least 2 objects.', recoverable: true })
        }
        break

      case 'align-objects':
        if (op.targets.length < 2) {
          errors.push({ operationId: op.id, code: 'INSUFFICIENT_SELECTION', message: 'Align requires at least 2 objects.', recoverable: true })
        }
        break

      case 'distribute-objects':
        if (op.targets.length < 3) {
          errors.push({ operationId: op.id, code: 'INSUFFICIENT_SELECTION', message: 'Distribute requires at least 3 objects.', recoverable: true })
        }
        break

      case 'set-opacity':
        if (!Number.isFinite(op.opacity) || op.opacity < 0 || op.opacity > 1) {
          errors.push({ operationId: op.id, code: 'INVALID_RANGE', message: `Opacity must be between 0 and 1 (got ${op.opacity}).`, recoverable: false })
        }
        break

      case 'set-blend-mode':
        if (!BLEND_MODES.includes(op.blendMode)) {
          errors.push({ operationId: op.id, code: 'INVALID_BLEND_MODE', message: `Unsupported blend mode: ${op.blendMode}`, recoverable: false })
        }
        break

      case 'move-object':
        if (op.x !== undefined && !Number.isFinite(op.x)) {
          errors.push({ operationId: op.id, code: 'INVALID_COORDINATE', message: 'x must be a finite number.', recoverable: false })
        }
        if (op.y !== undefined && !Number.isFinite(op.y)) {
          errors.push({ operationId: op.id, code: 'INVALID_COORDINATE', message: 'y must be a finite number.', recoverable: false })
        }
        break

      case 'resize-object':
        if (op.width !== undefined && !Number.isFinite(op.width)) {
          errors.push({ operationId: op.id, code: 'INVALID_DIMENSION', message: 'width must be a finite number.', recoverable: false })
        }
        if (op.height !== undefined && !Number.isFinite(op.height)) {
          errors.push({ operationId: op.id, code: 'INVALID_DIMENSION', message: 'height must be a finite number.', recoverable: false })
        }
        break

      case 'rotate-object':
        if (!Number.isFinite(op.degrees)) {
          errors.push({ operationId: op.id, code: 'INVALID_RANGE', message: 'Rotation degrees must be a finite number.', recoverable: false })
        }
        break

      case 'ungroup-objects': {
        const obj = op.target.objectId ? context.objects.find(o => o.id === op.target.objectId) : undefined
        if (obj && obj.type !== 'group') {
          errors.push({ operationId: op.id, code: 'INVALID_TARGET_TYPE', message: 'Ungroup target is not a group.', recoverable: false })
        }
        break
      }

      case 'rename-object':
        if (!op.name.trim()) {
          errors.push({ operationId: op.id, code: 'INVALID_VALUE', message: 'Rename requires a non-empty name.', recoverable: false })
        }
        break

      default:
        break
    }
  }

  return errors
}
