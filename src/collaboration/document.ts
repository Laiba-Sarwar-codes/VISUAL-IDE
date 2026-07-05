// src/collaboration/document.ts
// Module 14 — Yjs document structure definition

import * as Y from 'yjs'
import type { CollabDocumentMeta, CollabCameraState } from './types'

export interface CollabDocument {
  doc: Y.Doc
  sceneObjects: Y.Map<unknown>
  meta: Y.Map<unknown>
  camera: Y.Map<unknown>
}

/**
 * Why: creates a fresh Yjs document with all shared maps initialized.
 * Named maps mean any peer loading the same document gets identical
 * structure automatically — Yjs creates the map if it doesn't exist,
 * or returns the existing one.
 */
export function createCollabDocument(
  documentId: string,
  projectName: string
): CollabDocument {
  const doc = new Y.Doc()
  const sceneObjects = doc.getMap('scene-objects')
  const meta = doc.getMap('meta')
  const camera = doc.getMap('camera')

  doc.transact(() => {
    const now = Date.now()
    meta.set('documentId', documentId)
    meta.set('projectName', projectName)
    meta.set('createdAt', now)
    meta.set('updatedAt', now)
    meta.set('version', 1)
  })

  doc.transact(() => {
    camera.set('x', 0)
    camera.set('y', 0)
    camera.set('zoom', 1)
  })

  return { doc, sceneObjects, meta, camera }
}

/**
 * Why: when loading an existing document from IndexedDB or a network
 * peer, named maps are retrieved from the doc without re-initialization
 * since Yjs maps are created lazily and state is loaded from the update.
 */
export function loadCollabDocument(doc: Y.Doc): CollabDocument {
  return {
    doc,
    sceneObjects: doc.getMap('scene-objects'),
    meta:         doc.getMap('meta'),
    camera:       doc.getMap('camera'),
  }
}

/**
 * Why: centralized meta update so every caller always sets updatedAt
 * without remembering to do it manually.
 */
export function updateDocumentMeta(
  collabDoc: CollabDocument,
  changes: Partial<CollabDocumentMeta>
): void {
  collabDoc.doc.transact(() => {
    for (const [key, value] of Object.entries(changes)) {
      collabDoc.meta.set(key, value)
    }
    collabDoc.meta.set('updatedAt', Date.now())
  })
}

export function getCameraState(collabDoc: CollabDocument): CollabCameraState {
  return {
    x:    (collabDoc.camera.get('x') as number) ?? 0,
    y:    (collabDoc.camera.get('y') as number) ?? 0,
    zoom: (collabDoc.camera.get('zoom') as number) ?? 1,
  }
}

export function setCameraState(
  collabDoc: CollabDocument,
  state: CollabCameraState
): void {
  collabDoc.doc.transact(() => {
    collabDoc.camera.set('x', state.x)
    collabDoc.camera.set('y', state.y)
    collabDoc.camera.set('zoom', state.zoom)
  })
}