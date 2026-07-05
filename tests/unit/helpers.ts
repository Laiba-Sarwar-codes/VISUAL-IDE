// tests/unit/helpers.ts
// Shared test utilities for unit tests

import type { SceneObject } from '../../src/engine/scene-graph/types'

let idCounter = 0

/**
 * Why: tests need SceneObjects without importing createSceneObject
 * (which uses nanoid and may trigger side effects). This factory
 * creates deterministic objects with overridable defaults.
 */
export function makeObject(overrides: Partial<SceneObject> = {}): SceneObject {
  idCounter++
  return {
    id:       overrides.id       ?? `test-obj-${idCounter}`,
    name:     overrides.name     ?? `Object ${idCounter}`,
    type:     overrides.type     ?? 'rectangle',
    x:        overrides.x        ?? 0,
    y:        overrides.y        ?? 0,
    width:    overrides.width    ?? 100,
    height:   overrides.height   ?? 80,
    rotation: overrides.rotation ?? 0,
    visible:  overrides.visible  ?? true,
    locked:   overrides.locked   ?? false,
    opacity:  overrides.opacity  ?? 1,
    fill:     overrides.fill     ?? '#3b82f6',
    stroke:   overrides.stroke   ?? '#000000',
    zIndex:   overrides.zIndex   ?? idCounter - 1,
    text:     overrides.text,
    assetId:  overrides.assetId,
    parentId: overrides.parentId,
    expanded: overrides.expanded,
    blendMode: overrides.blendMode,
  }
}

export function makeObjects(count: number): SceneObject[] {
  return Array.from({ length: count }, (_, i) =>
    makeObject({ id: `obj-${i}`, zIndex: i })
  )
}

/** Reset counter between tests for deterministic ids */
export function resetIdCounter(): void {
  idCounter = 0
}