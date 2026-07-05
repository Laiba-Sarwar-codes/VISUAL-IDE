// src/collaboration/types.ts
// Module 14 — CRDT collaboration type definitions

export interface CollabUser {
  id: string
  name: string
  color: string
  cursorX: number
  cursorY: number
  selectedId: string | null
}

export interface CollabDocumentMeta {
  documentId: string
  projectName: string
  createdAt: number
  updatedAt: number
  version: number
}

export interface CollabCameraState {
  x: number
  y: number
  zoom: number
}

/**
 * The shape of a scene object as stored in Yjs.
 * Mirrors SceneObject but kept flat (no methods) since
 * Yjs maps only store plain serializable values.
 */
export interface CollabSceneObject {
  id: string
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  visible: boolean
  locked: boolean
  opacity: number
  fill: string
  stroke: string
  zIndex: number
  text?: string
  assetId?: string
  // Layer Management — mirrors SceneObject's hierarchy/blend-mode fields.
  parentId?: string | null
  expanded?: boolean
  blendMode?: string
}