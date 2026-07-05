// src/ai/AIOperationExecutor.ts
// AI Workflow — executes a validated AIExecutionPlan atomically against
// the *existing* scene/selection store actions (no new scene-mutation
// logic is written here — every branch below is a thin call into
// app/stores/scene.ts / app/stores/selection.ts, exactly the same
// actions a manual user edit would call, so persistence/CRDT sync/
// version control all keep working unchanged).
//
// Atomicity: the whole batch is wrapped in ONE PersistentHistoryService
// transaction — the service that actually drives Cmd+Z today (see the
// audit note in the project plan: HistoryManager's own per-action
// `record()` calls are harmless/inert for real undo purposes). On any
// failure mid-batch, the live scene is restored to its pre-plan snapshot
// and the transaction is cancelled — no partial state, no stray undo step.

import { useSceneStore } from '../../app/stores/scene'
import { useSelectionStore } from '../../app/stores/selection'
import type { SceneObject } from '../engine/scene-graph/types'
import type {
  AIExecutionPlan,
  AIExecutionResult,
  AIPlanOperation,
  AITargetRef,
  AITransactionAdapter,
} from './planTypes'

interface Priority2HistoryApi {
  getPersistentHistory(): {
    beginTransaction(label: string): string
    updateTransaction(snapshot: SceneObject[]): void
    commitTransaction(): Promise<boolean>
    cancelTransaction(): void
  } | null
}

function getPersistentHistoryService(): ReturnType<Priority2HistoryApi['getPersistentHistory']> {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { __COLLAB_PRIORITY2__?: Priority2HistoryApi }).__COLLAB_PRIORITY2__
  return api?.getPersistentHistory() ?? null
}

/**
 * Why: reaches PersistentHistoryService — the service that actually
 * drives Cmd+Z (see app/plugins/priority2.client.ts) — via the same
 * `window.__COLLAB_PRIORITY2__` bridge the plugin already exposes for
 * exactly this kind of external access. Falls back to a no-op (logged,
 * not thrown) if the plugin hasn't initialized yet, so AI operations
 * still execute correctly, just without the one-step-undo guarantee.
 */
export function createDefaultTransactionAdapter(): AITransactionAdapter {
  let service: ReturnType<Priority2HistoryApi['getPersistentHistory']> = null

  return {
    begin(label: string): void {
      service = getPersistentHistoryService()
      if (!service) {
        console.warn('[AIOperationExecutor] PersistentHistoryService unavailable — AI operation will execute without the one-step-undo guarantee.')
        return
      }
      service.beginTransaction(label)
    },
    updateSnapshot(): void {
      if (!service) return
      const scene = useSceneStore()
      service.updateTransaction(scene.objects.map(o => ({ ...o })))
    },
    async commit(): Promise<void> {
      if (!service) return
      await service.commitTransaction()
    },
    cancel(): void {
      service?.cancelTransaction()
    },
  }
}

function resolveTarget(ref: AITargetRef, refMap: Map<string, string>): string | null {
  if (ref.objectId) return ref.objectId
  if (ref.ref) return refMap.get(ref.ref) ?? null
  return null
}

function resolveTargets(refs: AITargetRef[], refMap: Map<string, string>): string[] {
  return refs
    .map(ref => resolveTarget(ref, refMap))
    .filter((id): id is string => id !== null)
}

/**
 * Executes every operation in `plan` in order via normal scene/selection
 * store actions, resolving temp refs (`resultRef`/`target.ref`) as it
 * goes. Snapshots the scene before starting; on any operation failure,
 * restores that snapshot and cancels the transaction — the plan either
 * fully applies or leaves no trace.
 */
export async function executePlan(
  plan: AIExecutionPlan,
  adapter: AITransactionAdapter = createDefaultTransactionAdapter()
): Promise<AIExecutionResult> {
  const startedAt = Date.now()
  const scene = useSceneStore()
  const selection = useSelectionStore()

  const beforeSnapshot = scene.objects.map(o => ({ ...o }))
  const refMap = new Map<string, string>()
  const affected = new Set<string>()
  const created: string[] = []

  adapter.begin(`AI: ${plan.originalPrompt}`)

  try {
    for (const op of plan.operations) {
      executeOne(op, scene, selection, refMap, affected, created)
    }

    adapter.updateSnapshot()
    await adapter.commit()

    return {
      planId: plan.id,
      success: true,
      executedOperationCount: plan.operations.length,
      affectedObjectIds: [...affected],
      createdObjectIds: created,
      warnings: plan.warnings,
      durationMs: Date.now() - startedAt,
    }
  } catch (err) {
    scene._setAllRaw(beforeSnapshot)
    adapter.cancel()
    return {
      planId: plan.id,
      success: false,
      executedOperationCount: 0,
      affectedObjectIds: [],
      createdObjectIds: [],
      warnings: plan.warnings,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : 'AI operation execution failed.',
    }
  }
}

function executeOne(
  op: AIPlanOperation,
  scene: ReturnType<typeof useSceneStore>,
  selection: ReturnType<typeof useSelectionStore>,
  refMap: Map<string, string>,
  affected: Set<string>,
  created: string[]
): void {
  switch (op.type) {
    case 'create-object': {
      const obj = scene.addObject({
        type: op.objectType, x: op.x, y: op.y, width: op.width, height: op.height,
        fill: op.fill, stroke: op.stroke, text: op.text, name: op.name,
      })
      if (op.resultRef) refMap.set(op.resultRef, obj.id)
      created.push(obj.id)
      affected.add(obj.id)
      return
    }

    case 'update-object': {
      const id = resolveTarget(op.target, refMap)
      if (!id) throw new Error(`Could not resolve target for "${op.description ?? op.type}".`)
      scene.updateObject(id, op.changes)
      affected.add(id)
      return
    }

    case 'delete-object': {
      const ids = resolveTargets(op.targets, refMap)
      if (ids.length === 0) throw new Error(`No targets resolved for "${op.description ?? op.type}".`)
      if (ids.length === 1) scene.removeObject(ids[0]!)
      else scene.removeObjects(ids)
      ids.forEach(id => affected.add(id))
      return
    }

    case 'move-object': {
      const id = resolveTarget(op.target, refMap)
      if (!id) throw new Error(`Could not resolve target for "${op.description ?? op.type}".`)
      const obj = scene.objects.find(o => o.id === id)
      if (!obj) throw new Error(`Target object not found for "${op.description ?? op.type}".`)

      if (op.toCenter) {
        scene.updateObject(id, { x: -obj.width / 2, y: -obj.height / 2 })
      } else if (op.anchor && op.anchorDirection) {
        const anchorId = resolveTarget(op.anchor, refMap)
        const anchorObj = anchorId ? scene.objects.find(o => o.id === anchorId) : undefined
        if (!anchorObj) throw new Error(`Anchor object not found for "${op.description ?? op.type}".`)
        const gap = op.gap ?? 20
        let x = obj.x
        let y = obj.y
        switch (op.anchorDirection) {
          case 'above': x = anchorObj.x; y = anchorObj.y - obj.height - gap; break
          case 'below': x = anchorObj.x; y = anchorObj.y + anchorObj.height + gap; break
          case 'left-of': x = anchorObj.x - obj.width - gap; y = anchorObj.y; break
          case 'right-of': x = anchorObj.x + anchorObj.width + gap; y = anchorObj.y; break
        }
        scene.updateObject(id, { x, y })
      } else if (op.relative) {
        scene.updateObject(id, { x: obj.x + (op.x ?? 0), y: obj.y + (op.y ?? 0) })
      } else {
        scene.updateObject(id, { x: op.x ?? obj.x, y: op.y ?? obj.y })
      }
      affected.add(id)
      return
    }

    case 'resize-object': {
      const id = resolveTarget(op.target, refMap)
      if (!id) throw new Error(`Could not resolve target for "${op.description ?? op.type}".`)
      const obj = scene.objects.find(o => o.id === id)
      if (!obj) throw new Error(`Target object not found for "${op.description ?? op.type}".`)
      const changes: Partial<SceneObject> = {}
      if (op.width !== undefined) changes.width = Math.max(1, op.relative ? obj.width + op.width : op.width)
      if (op.height !== undefined) changes.height = Math.max(1, op.relative ? obj.height + op.height : op.height)
      scene.updateObject(id, changes)
      affected.add(id)
      return
    }

    case 'rotate-object': {
      const id = resolveTarget(op.target, refMap)
      if (!id) throw new Error(`Could not resolve target for "${op.description ?? op.type}".`)
      const obj = scene.objects.find(o => o.id === id)
      if (!obj) throw new Error(`Target object not found for "${op.description ?? op.type}".`)
      scene.updateObject(id, { rotation: op.relative ? obj.rotation + op.degrees : op.degrees })
      affected.add(id)
      return
    }

    case 'duplicate-object': {
      const ids = resolveTargets(op.targets, refMap)
      if (ids.length === 0) throw new Error(`No targets resolved for "${op.description ?? op.type}".`)
      const newIds: string[] = []
      for (const id of ids) {
        const obj = scene.objects.find(o => o.id === id)
        if (!obj) continue
        const copy = scene.addObject({
          type: obj.type,
          x: obj.x + (op.offsetX ?? 20),
          y: obj.y + (op.offsetY ?? 20),
          width: obj.width,
          height: obj.height,
          fill: obj.fill,
          stroke: obj.stroke,
          text: obj.text,
          assetId: obj.assetId,
          name: `${obj.name} copy`,
        })
        newIds.push(copy.id)
        created.push(copy.id)
        affected.add(copy.id)
      }
      if (op.resultRef && newIds.length > 0) refMap.set(op.resultRef, newIds[0]!)
      return
    }

    case 'align-objects': {
      const ids = resolveTargets(op.targets, refMap)
      scene.alignSelected(ids, op.edge)
      ids.forEach(id => affected.add(id))
      return
    }

    case 'distribute-objects': {
      const ids = resolveTargets(op.targets, refMap)
      scene.distributeSelected(ids, op.axis)
      ids.forEach(id => affected.add(id))
      return
    }

    case 'group-objects': {
      const ids = resolveTargets(op.targets, refMap)
      if (ids.length < 2) return // scene.groupSelected already safely no-ops on <2 targets
      const groupId = scene.groupSelected(ids)
      if (groupId) {
        if (op.resultRef) refMap.set(op.resultRef, groupId)
        affected.add(groupId)
        ids.forEach(id => affected.add(id))
      }
      return
    }

    case 'ungroup-objects': {
      const id = resolveTarget(op.target, refMap)
      if (!id) throw new Error(`Could not resolve target for "${op.description ?? op.type}".`)
      scene.ungroupSelected(id)
      affected.add(id)
      return
    }

    case 'reorder-object': {
      const id = resolveTarget(op.target, refMap)
      if (!id) throw new Error(`Could not resolve target for "${op.description ?? op.type}".`)
      if (op.direction === 'front') scene.bringToFront(id)
      else if (op.direction === 'forward') scene.bringForward(id)
      else if (op.direction === 'backward') scene.sendBackward(id)
      else scene.sendToBack(id)
      affected.add(id)
      return
    }

    case 'set-visibility': {
      const ids = resolveTargets(op.targets, refMap)
      for (const id of ids) {
        const obj = scene.objects.find(o => o.id === id)
        if (obj && obj.visible !== op.visible) scene.toggleVisibility(id)
        affected.add(id)
      }
      return
    }

    case 'set-lock': {
      const ids = resolveTargets(op.targets, refMap)
      for (const id of ids) {
        const obj = scene.objects.find(o => o.id === id)
        if (obj && obj.locked !== op.locked) scene.toggleLocked(id)
        affected.add(id)
      }
      return
    }

    case 'set-opacity': {
      const ids = resolveTargets(op.targets, refMap)
      for (const id of ids) {
        scene.setOpacity(id, op.opacity)
        affected.add(id)
      }
      return
    }

    case 'set-blend-mode': {
      const ids = resolveTargets(op.targets, refMap)
      for (const id of ids) {
        scene.setBlendMode(id, op.blendMode)
        affected.add(id)
      }
      return
    }

    case 'select-objects': {
      const ids = resolveTargets(op.targets, refMap)
      selection.selectRange(ids)
      ids.forEach(id => affected.add(id))
      return
    }

    case 'rename-object': {
      const id = resolveTarget(op.target, refMap)
      if (!id) throw new Error(`Could not resolve target for "${op.description ?? op.type}".`)
      scene.renameNode(id, op.name)
      affected.add(id)
      return
    }

    default: {
      const exhaustive: never = op
      throw new Error(`Unsupported AI operation type: ${(exhaustive as AIPlanOperation).type}`)
    }
  }
}
