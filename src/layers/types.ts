// src/layers/types.ts
// Layer Management — blend modes and the layer-tree read model.
//
// Why a read-model type here instead of a persisted tree: the hierarchy
// lives on SceneObject.parentId (single source of truth, see
// CLAUDE.md/plan). LayerTreeNode is only ever computed on demand by
// LayerTreeService — it is never stored or synced itself.

import type { SceneObject, SceneObjectType } from '../engine/scene-graph/types'

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'

export const BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
]

// Canvas 2D's GlobalCompositeOperation values line up 1:1 with the CSS
// blend-mode names above, except 'normal' which is 'source-over'.
const BLEND_MODE_TO_COMPOSITE_OP: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
}

/**
 * Why: blend mode may be missing (older objects), or corrupted by a
 * stale/un-migrated remote peer. Falling back to 'source-over' keeps
 * rendering correct instead of throwing or silently no-op'ing the paint.
 */
export function resolveCompositeOperation(mode: BlendMode | undefined | null): GlobalCompositeOperation {
  if (!mode) return 'source-over'
  return BLEND_MODE_TO_COMPOSITE_OP[mode] ?? 'source-over'
}

export function isValidBlendMode(value: unknown): value is BlendMode {
  return typeof value === 'string' && (BLEND_MODES as readonly string[]).includes(value)
}

export type LayerNodeKind = 'leaf' | 'group' | 'folder'

/** Read-model tree built on demand from SceneObject[] by LayerTreeService. */
export interface LayerTreeNode {
  id: string
  kind: LayerNodeKind
  objectType: SceneObjectType
  name: string
  parentId: string | null
  children: LayerTreeNode[]
  expanded: boolean
  visible: boolean
  locked: boolean
  opacity: number
  blendMode?: BlendMode
  object: SceneObject
}
