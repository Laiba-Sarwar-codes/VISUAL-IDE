// src/storage/local/types.ts
// Module 14 — added yjsUpdate field for CRDT persistence

import type { SceneObject } from '../../engine/scene-graph/types'

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  objectCount: number
  thumbnail?: string
}

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  objects: SceneObject[]
  camera: {
    x: number
    y: number
    zoom: number
  }
  meta: {
    activeTool: string
    version: number
  }
  /**
   * Why: storing the Yjs encoded state alongside the scene objects means
   * when the project is loaded, the CRDT document can be restored from
   * the exact same state — not reconstructed from scene objects. This
   * preserves CRDT metadata (vector clocks, delete sets) needed for
   * correct merging when collaboration arrives in Module 15.
   * Stored as a number[] (JSON-serializable form of Uint8Array) since
   * IndexedDB can store it but JSON.stringify can't handle Uint8Array.
   */
  yjsUpdate?: number[]
}

export const CURRENT_SCHEMA_VERSION = 1
/**
 * V1: StoredAssetRecord — persists asset blob in IndexedDB so assets
 * survive page refresh. Scene objects reference stable asset IDs.
 * Object URLs are recreated from the blob on project load.
 */
export interface StoredAssetRecord {
  id: string
  projectId: string
  name: string
  mimeType: string
  size: number
  width?: number
  height?: number
  createdAt: number
  updatedAt: number
  blob: Blob
}
