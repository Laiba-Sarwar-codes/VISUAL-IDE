// src/ai/AIPlanBuilder.ts
// AI Workflow — turns ParsedStep[] (from AIPromptParser) + reference
// resolution (from AIReferenceResolver) into a validated-shape
// AIExecutionPlan. Handles multi-step temp-ref chaining: pronouns like
// "it"/"them"/"the copy" in a later step resolve to whatever the most
// recent create/duplicate/select-like step targeted, via `AITargetRef.ref`
// rather than a real object id (resolved during execution — see
// AIOperationExecutor.ts). Kept parsing-free and execution-free — pure
// transformation only, per the "keep parsing/validation/execution separate"
// architecture rule.

import { nanoid } from 'nanoid'
import { resolveReference } from './AIReferenceResolver'
import type { AIEditorContext, AIPlanOperation, AIExecutionPlan, AITargetRef, ParsedStep } from './planTypes'

const DESTRUCTIVE_BATCH_THRESHOLD = 5
const PRONOUN_PATTERN = /\b(it|them|these|those|the copy|the copies|the new (?:object|rectangle|ellipse|circle|shape|text|group))\b/i

function resolveTargets(
  phrase: string,
  context: AIEditorContext,
  lastTargets: AITargetRef[]
): { refs: AITargetRef[]; warning?: string } {
  if (lastTargets.length > 0 && PRONOUN_PATTERN.test(phrase)) {
    return { refs: lastTargets }
  }
  const result = resolveReference(phrase, context)
  return { refs: result.ids.map((id): AITargetRef => ({ objectId: id })), warning: result.warning }
}

function isLockedTarget(ref: AITargetRef, context: AIEditorContext): boolean {
  if (!ref.objectId) return false // temp refs don't exist yet — can't be locked
  return context.objects.find(o => o.id === ref.objectId)?.locked ?? false
}

export function buildPlan(steps: ParsedStep[], context: AIEditorContext, originalPrompt: string): AIExecutionPlan {
  const operations: AIPlanOperation[] = []
  const warnings: string[] = []
  let createCounter = 0
  let lastTargets: AITargetRef[] = []
  let touchedLockedObject = false
  let largestBatchSize = 0

  const recordBatch = (targets: AITargetRef[]): void => {
    largestBatchSize = Math.max(largestBatchSize, targets.length)
    if (targets.some(t => isLockedTarget(t, context))) touchedLockedObject = true
  }

  for (const step of steps) {
    switch (step.intent) {
      case 'create': {
        const count = step.count ?? 1
        const createdRefs: string[] = []
        for (let i = 0; i < count; i++) {
          createCounter += 1
          const ref = `created-object-${createCounter}`
          createdRefs.push(ref)
          operations.push({
            id: nanoid(),
            type: 'create-object',
            objectType: step.objectType ?? 'rectangle',
            x: 100 + i * 140,
            y: 200,
            fill: step.color,
            text: step.objectType === 'text' ? (step.text ?? 'Text') : undefined,
            resultRef: ref,
            description: `Create ${step.objectType ?? 'rectangle'}${count > 1 ? ` (${i + 1}/${count})` : ''}`,
          })
        }
        lastTargets = createdRefs.map((ref): AITargetRef => ({ ref }))
        break
      }

      case 'duplicate': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        createCounter += 1
        const resultRef = `created-object-${createCounter}`
        operations.push({
          id: nanoid(), type: 'duplicate-object', targets: refs,
          offsetX: 40, offsetY: 40, resultRef,
          description: `Duplicate ${refs.length === 1 ? 'object' : `${refs.length} objects`}`,
        })
        lastTargets = [{ ref: resultRef }]
        break
      }

      case 'delete': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        operations.push({
          id: nanoid(), type: 'delete-object', targets: refs,
          description: `Delete ${refs.length === 1 ? 'object' : `${refs.length} objects`}`,
        })
        lastTargets = []
        break
      }

      case 'set-color': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        for (const ref of refs) {
          operations.push({
            id: nanoid(), type: 'update-object', target: ref, changes: { fill: step.color ?? '#3b82f6' },
            description: `Set color to ${step.color ?? '#3b82f6'}`,
          })
        }
        lastTargets = refs
        break
      }

      case 'set-opacity': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        operations.push({
          id: nanoid(), type: 'set-opacity', targets: refs, opacity: step.opacityValue ?? 0.5,
          description: `Set opacity to ${Math.round((step.opacityValue ?? 0.5) * 100)}%`,
        })
        lastTargets = refs
        break
      }

      case 'set-blend-mode': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        operations.push({
          id: nanoid(), type: 'set-blend-mode', targets: refs, blendMode: step.blendMode ?? 'normal',
          description: `Set blend mode to ${step.blendMode ?? 'normal'}`,
        })
        lastTargets = refs
        break
      }

      case 'set-visibility': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        operations.push({
          id: nanoid(), type: 'set-visibility', targets: refs, visible: step.visibilityValue ?? true,
          description: `${step.visibilityValue ? 'Show' : 'Hide'} ${refs.length === 1 ? 'object' : `${refs.length} objects`}`,
        })
        lastTargets = refs
        break
      }

      case 'set-lock': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        operations.push({
          id: nanoid(), type: 'set-lock', targets: refs, locked: step.lockValue ?? true,
          description: `${step.lockValue ? 'Lock' : 'Unlock'} ${refs.length === 1 ? 'object' : `${refs.length} objects`}`,
        })
        lastTargets = refs
        break
      }

      case 'align': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        operations.push({
          id: nanoid(), type: 'align-objects', targets: refs, edge: step.edge ?? 'left',
          description: `Align ${refs.length} objects: ${step.edge ?? 'left'}`,
        })
        if (refs.length < 2) warnings.push('Align needs at least 2 objects — fewer were resolved.')
        lastTargets = refs
        break
      }

      case 'distribute': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        operations.push({
          id: nanoid(), type: 'distribute-objects', targets: refs, axis: step.axis ?? 'horizontal',
          description: `Distribute ${refs.length} objects: ${step.axis ?? 'horizontal'}`,
        })
        if (refs.length < 3) warnings.push('Distribute needs at least 3 objects — fewer were resolved.')
        lastTargets = refs
        break
      }

      case 'group': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        createCounter += 1
        const resultRef = `created-object-${createCounter}`
        operations.push({
          id: nanoid(), type: 'group-objects', targets: refs, resultRef,
          description: `Group ${refs.length} objects`,
        })
        if (refs.length < 2) warnings.push('Group needs at least 2 objects — fewer were resolved.')
        lastTargets = [{ ref: resultRef }]
        break
      }

      case 'ungroup': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        const target = refs[0]
        if (target) {
          operations.push({ id: nanoid(), type: 'ungroup-objects', target, description: 'Ungroup' })
        } else {
          warnings.push('No group was resolved to ungroup.')
        }
        lastTargets = refs
        break
      }

      case 'reorder': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        const target = refs[0]
        if (target) {
          operations.push({
            id: nanoid(), type: 'reorder-object', target, direction: step.direction ?? 'front',
            description: `Reorder: ${step.direction ?? 'front'}`,
          })
        } else {
          warnings.push('No object was resolved to reorder.')
        }
        lastTargets = refs
        break
      }

      case 'select': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        operations.push({
          id: nanoid(), type: 'select-objects', targets: refs,
          description: `Select ${refs.length} object${refs.length === 1 ? '' : 's'}`,
        })
        lastTargets = refs
        break
      }

      case 'rename': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        const target = refs[0]
        if (!step.newName) {
          warnings.push('Rename requires a new name (e.g. "rename it to Header") — no new name was given.')
        } else if (target) {
          operations.push({ id: nanoid(), type: 'rename-object', target, name: step.newName, description: `Rename to "${step.newName}"` })
        } else {
          warnings.push('No object was resolved to rename.')
        }
        lastTargets = refs
        break
      }

      case 'resize': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        const target = refs[0]
        if (target) {
          operations.push({
            id: nanoid(), type: 'resize-object', target, relative: step.resizeRelative ?? true,
            width: step.resizeProperty === 'width' ? step.resizeDelta : undefined,
            height: step.resizeProperty === 'height' ? step.resizeDelta : undefined,
            description: `Resize ${step.resizeProperty ?? 'width'} by ${step.resizeDelta ?? 40}`,
          })
        } else {
          warnings.push('No object was resolved to resize.')
        }
        lastTargets = refs
        break
      }

      case 'rotate': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        const target = refs[0]
        if (target) {
          operations.push({
            id: nanoid(), type: 'rotate-object', target, degrees: step.rotateDegrees ?? 90,
            description: `Rotate ${step.rotateDegrees ?? 90} degrees`,
          })
        } else {
          warnings.push('No object was resolved to rotate.')
        }
        lastTargets = refs
        break
      }

      case 'move': {
        const { refs, warning } = resolveTargets(step.referencePhrase, context, lastTargets)
        if (warning) warnings.push(warning)
        recordBatch(refs)
        const target = refs[0]
        if (!target) {
          warnings.push('No object was resolved to move.')
          lastTargets = refs
          break
        }
        if (step.moveMode === 'relative-anchor' && step.anchorPhrase) {
          const anchorResult = resolveReference(step.anchorPhrase, context)
          if (anchorResult.warning) warnings.push(anchorResult.warning)
          const anchorId = anchorResult.ids[0]
          if (anchorId) {
            operations.push({
              id: nanoid(), type: 'move-object', target,
              anchor: { objectId: anchorId }, anchorDirection: step.anchorDirection, gap: 20,
              description: `Move ${step.anchorDirection ?? 'below'} ${step.anchorPhrase}`,
            })
          } else {
            warnings.push(`Could not resolve the anchor object "${step.anchorPhrase}" for the move.`)
          }
        } else if (step.moveMode === 'delta') {
          operations.push({
            id: nanoid(), type: 'move-object', target, x: step.moveDx ?? 0, y: step.moveDy ?? 0, relative: true,
            description: 'Move',
          })
        } else {
          operations.push({ id: nanoid(), type: 'move-object', target, toCenter: true, description: 'Center' })
        }
        lastTargets = refs
        break
      }

      case 'unknown':
      default:
        warnings.push(`I didn't understand: "${step.raw}".`)
        break
    }
  }

  const requiresConfirmation =
    warnings.length > 0 ||
    touchedLockedObject ||
    largestBatchSize > DESTRUCTIVE_BATCH_THRESHOLD ||
    operations.some(op => op.type === 'delete-object' && op.targets.length > 1) ||
    operations.some(op => op.type === 'delete-object' && op.targets.some(t => t.objectId && context.objects.find(o => o.id === t.objectId)?.type === 'group'))

  const summary = operations.length > 0
    ? `${operations.length} operation${operations.length === 1 ? '' : 's'}: ${operations.map(o => o.description ?? o.type).join('; ')}`
    : 'No operations could be generated from this instruction.'

  return {
    id: nanoid(),
    originalPrompt,
    summary,
    operations,
    warnings,
    requiresConfirmation,
    createdAt: Date.now(),
  }
}
