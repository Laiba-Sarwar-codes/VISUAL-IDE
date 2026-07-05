// src/collaboration/SceneSync.ts
// Module 14 — bidirectional sync between scene store and Yjs
//
// Fix: moved _syncing flag from module-level to per-call closure scope.
// The original module-level flag bleeds between multiple invocations of
// startSceneSync (e.g. when switching projects). If project A starts
// syncing, sets _syncing = true, and then project B calls startSceneSync,
// project B's observer sees _syncing = true from project A's transaction
// and silently skips the update. Each sync pair now owns its own flag.

import { watch } from 'vue'
import { normalizeHierarchy } from '../layers/layerMigration'
import type { CollabDocument } from './document'
import type { CollabSceneObject } from './types'
import type { SceneObject } from '../engine/scene-graph/types'

interface SceneStoreInterface {
  objects: SceneObject[]
  _addRaw: (o: SceneObject) => void
  _removeRaw: (id: string) => void
  _updateRaw: (id: string, changes: Partial<SceneObject>) => void
  _setAllRaw: (objects: SceneObject[]) => void
}

export function startSceneSync(
  collabDoc: CollabDocument,
  sceneStore: SceneStoreInterface
): () => void {
  // Fix: per-invocation flag — no module-level leakage between projects
  let syncing = false

  // ── Direction 1: Scene Store → Yjs ──────────────────────────────────
  const stopWatch = watch(
    () => sceneStore.objects,
    (objects) => {
      if (syncing) return
      syncing = true
      try {
        collabDoc.doc.transact(() => {
          const yjsIds = new Set<string>(
            [...collabDoc.sceneObjects.keys()].map(k => String(k))
          )
          const sceneIds = new Set(objects.map(o => o.id))

          for (const id of yjsIds) {
            if (!sceneIds.has(id)) collabDoc.sceneObjects.delete(id)
          }

          for (const obj of objects) {
            collabDoc.sceneObjects.set(obj.id, sceneObjectToCollab(obj))
          }
        })
      } finally {
        syncing = false
      }
    },
    { deep: true }
  )

  // ── Direction 2: Yjs → Scene Store ──────────────────────────────────
  const yjsObserver = () => {
    if (syncing) return
    syncing = true
    try {
      const yjsObjects = Array.from(
        collabDoc.sceneObjects.values()
      ) as CollabSceneObject[]
      const sceneObjects = normalizeHierarchy(yjsObjects.map(collabToSceneObject))
      sceneStore._setAllRaw(sceneObjects)
    } finally {
      syncing = false
    }
  }

  collabDoc.sceneObjects.observe(yjsObserver)

  return () => {
    stopWatch()
    collabDoc.sceneObjects.unobserve(yjsObserver)
  }
}

function sceneObjectToCollab(obj: SceneObject): CollabSceneObject {
  return {
    id:       obj.id,
    name:     obj.name,
    type:     obj.type,
    x:        obj.x,
    y:        obj.y,
    width:    obj.width,
    height:   obj.height,
    rotation: obj.rotation,
    visible:  obj.visible,
    locked:   obj.locked,
    opacity:  obj.opacity,
    fill:     obj.fill,
    stroke:   obj.stroke,
    zIndex:   obj.zIndex,
    text:     obj.text,
    assetId:  obj.assetId,
    parentId: obj.parentId ?? null,
    expanded: obj.expanded,
    blendMode: obj.blendMode,
  }
}

function collabToSceneObject(obj: CollabSceneObject): SceneObject {
  return {
    id:       obj.id,
    name:     obj.name,
    type:     obj.type as SceneObject['type'],
    x:        obj.x,
    y:        obj.y,
    width:    obj.width,
    height:   obj.height,
    rotation: obj.rotation,
    visible:  obj.visible,
    locked:   obj.locked,
    opacity:  obj.opacity,
    fill:     obj.fill,
    stroke:   obj.stroke,
    zIndex:   obj.zIndex,
    text:     obj.text,
    assetId:  obj.assetId,
    parentId: obj.parentId ?? null,
    expanded: obj.expanded,
    blendMode: obj.blendMode as SceneObject['blendMode'],
  }
}