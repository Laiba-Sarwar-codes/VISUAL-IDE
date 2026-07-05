// src/ai/AIContextBuilder.ts
// AI Workflow — builds a minimal, read-only, JSON-serializable editor
// context for the parser/resolver/worker. Never exposes a live Pinia
// store: the rest of the AI pipeline (parser, reference resolver, plan
// builder, worker) only ever sees this plain snapshot, so the exact same
// code can run on the main thread or inside a Web Worker (postMessage
// requires plain data).

import { Camera } from '../engine/rendering/Camera'
import { getViewportBounds } from '../engine/performance/viewport'
import { BLEND_MODES } from '../layers/types'
import { useSceneStore } from '../../app/stores/scene'
import { useSelectionStore } from '../../app/stores/selection'
import { useEditorStore } from '../../app/stores/editor'
import type { SceneObjectType } from '../engine/scene-graph/types'
import type { AIContextObject, AIEditorContext } from './planTypes'

const SUPPORTED_OBJECT_TYPES: SceneObjectType[] = ['rectangle', 'ellipse', 'text', 'image', 'group', 'folder']

export const SUPPORTED_OPERATION_TYPES: string[] = [
  'create-object', 'update-object', 'delete-object', 'move-object', 'resize-object',
  'rotate-object', 'duplicate-object', 'align-objects', 'distribute-objects',
  'group-objects', 'ungroup-objects', 'reorder-object', 'set-visibility',
  'set-lock', 'set-opacity', 'set-blend-mode', 'select-objects', 'rename-object',
]

// Used only when the real browser viewport can't be read (SSR/tests) —
// keeps `objects inside the current viewport` resolvable without crashing.
const DEFAULT_VIEWPORT_WIDTH = 1600
const DEFAULT_VIEWPORT_HEIGHT = 900

/**
 * Why: reads the scene/selection/editor stores exactly once and copies
 * out only the plain fields the AI pipeline needs — no store references,
 * no methods, no reactivity, so this is safe to pass across a
 * postMessage boundary or hand to a pure function running in a worker.
 */
export function buildEditorContext(): AIEditorContext {
  const scene = useSceneStore()
  const selection = useSelectionStore()
  const editor = useEditorStore()

  const objects: AIContextObject[] = scene.objects.map((o): AIContextObject => ({
    id: o.id,
    type: o.type,
    name: o.name,
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    zIndex: o.zIndex,
    visible: o.visible,
    locked: o.locked,
    opacity: o.opacity,
    blendMode: o.blendMode,
    parentId: o.parentId ?? null,
  }))

  let viewport = {
    left: -DEFAULT_VIEWPORT_WIDTH / 2,
    top: -DEFAULT_VIEWPORT_HEIGHT / 2,
    right: DEFAULT_VIEWPORT_WIDTH / 2,
    bottom: DEFAULT_VIEWPORT_HEIGHT / 2,
  }
  try {
    const width = typeof window !== 'undefined' ? window.innerWidth : DEFAULT_VIEWPORT_WIDTH
    const height = typeof window !== 'undefined' ? window.innerHeight : DEFAULT_VIEWPORT_HEIGHT
    const camera = new Camera({ x: editor.cameraX, y: editor.cameraY, zoom: editor.zoom })
    viewport = getViewportBounds(camera, width, height)
  } catch {
    // keep the default centered viewport computed above
  }

  return {
    objects,
    selectedObjectIds: [...selection.selectedIds],
    viewport,
    supportedObjectTypes: SUPPORTED_OBJECT_TYPES,
    supportedBlendModes: [...BLEND_MODES],
    supportedOperationTypes: SUPPORTED_OPERATION_TYPES,
  }
}
