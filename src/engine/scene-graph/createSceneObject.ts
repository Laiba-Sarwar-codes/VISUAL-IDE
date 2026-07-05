// src/engine/scene-graph/createSceneObject.ts
// Module 5 — fixed: added image type to DEFAULT_SIZE and DEFAULT_FILL

import { nanoid } from 'nanoid'
import type { CreateSceneObjectInput, SceneObject } from './types'

type SceneObjectType = SceneObject['type']

// Fixed: image type added so all SceneObjectType values are covered
// Layer Management: 'group'/'folder' added — both are organizational/
// bounding-box-only, never drawn directly, but still need defaults
// since DEFAULT_SIZE/DEFAULT_FILL are exhaustive Records.
const DEFAULT_SIZE: Record<SceneObjectType, { width: number; height: number }> = {
  rectangle: { width: 120, height: 80 },
  ellipse:   { width: 120, height: 80 },
  text:      { width: 160, height: 32 },
  image:     { width: 200, height: 150 },
  group:     { width: 0, height: 0 },
  folder:    { width: 0, height: 0 },
}

// Fixed: image type added
const DEFAULT_FILL: Record<SceneObjectType, string> = {
  rectangle: '#3b82f6',
  ellipse:   '#22c55e',
  text:      'transparent',
  image:     'transparent',
  group:     'transparent',
  folder:    'transparent',
}

/**
 * Why: every place that creates an object needs identical defaulting
 * logic. Centralizing here means the scene store and canvas event
 * handlers never duplicate that logic or risk forgetting a field.
 */
export function createSceneObject(
  input: CreateSceneObjectInput,
  nextZIndex: number
): SceneObject {
  const size = DEFAULT_SIZE[input.type]

  return {
    id:       nanoid(),
    name:     input.name ?? defaultName(input.type, nextZIndex),
    type:     input.type,
    x:        input.x ?? 0,
    y:        input.y ?? 0,
    width:    input.width  ?? size.width,
    height:   input.height ?? size.height,
    rotation: 0,
    visible:  true,
    locked:   false,
    opacity:  input.opacity ?? 1,
    fill:     input.fill   ?? DEFAULT_FILL[input.type],
    stroke:   input.stroke ?? '#000000',
    zIndex:   nextZIndex,
    text:     input.type === 'text'  ? (input.text   ?? 'Text') : undefined,
    assetId:  input.type === 'image' ? (input.assetId ?? undefined) : undefined,
    parentId: input.parentId ?? null,
    expanded: input.type === 'group' || input.type === 'folder' ? true : undefined,
  }
}

function defaultName(type: SceneObjectType, index: number): string {
  const label = type.charAt(0).toUpperCase() + type.slice(1)
  return `${label} ${index + 1}`
}