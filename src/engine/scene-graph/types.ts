// src/engine/scene-graph/types.ts
// Module 12 — adds image type to scene objects
// Layer Management — adds 'group'/'folder' types + parentId/expanded/blendMode
// (all new fields optional so existing flat projects/objects stay valid as-is)

import type { BlendMode } from '../../layers/types'

export type SceneObjectType = 'rectangle' | 'ellipse' | 'text' | 'image' | 'group' | 'folder'

export interface SceneObject {
  id: string
  name: string
  type: SceneObjectType
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
  text?: string       // text objects only
  assetId?: string    // image/svg objects only — references Asset.id

  // Layer hierarchy — null/undefined means root-level. Ordering among
  // siblings is by zIndex scoped to objects sharing the same parentId
  // (see LayerManager's sibling-scope parameter), not a separate array.
  parentId?: string | null
  // Expand/collapse UI state for 'group'/'folder' nodes in the layer panel.
  expanded?: boolean
  // Canvas 2D globalCompositeOperation, validated via resolveCompositeOperation.
  // Missing/invalid falls back to 'source-over' so existing objects render
  // exactly as before.
  blendMode?: BlendMode
}

export type CreateSceneObjectInput = Partial<Pick<SceneObject,
  'x' | 'y' | 'width' | 'height' | 'fill' | 'stroke' |
  'opacity' | 'text' | 'name' | 'assetId' | 'parentId'
>> & {
  type: SceneObjectType
}