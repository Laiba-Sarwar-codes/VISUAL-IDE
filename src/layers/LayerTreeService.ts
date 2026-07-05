// src/layers/LayerTreeService.ts
// Layer Management — builds a read-model tree from the flat SceneObject[]
// array (parentId + zIndex), computes paint order, the layer-panel's
// visible flattened order, and ancestor-aware "effective" property
// resolution (visibility/locked/opacity/blend mode).
//
// This is the only place the hierarchy is turned into a tree — everything
// else (renderer, hit-test, layer panel, exporters) consumes these pure
// functions rather than walking parentId chains themselves.

import type { SceneObject } from '../engine/scene-graph/types'
import type { BlendMode, LayerNodeKind, LayerTreeNode } from './types'

const MAX_DEPTH = 500 // defensive guard against pathological/cyclic data

function kindOf(obj: SceneObject): LayerNodeKind {
  if (obj.type === 'group') return 'group'
  if (obj.type === 'folder') return 'folder'
  return 'leaf'
}

function groupByParent(objects: SceneObject[]): Map<string | null, SceneObject[]> {
  const byParent = new Map<string | null, SceneObject[]>()
  for (const obj of objects) {
    const key = obj.parentId ?? null
    const siblings = byParent.get(key)
    if (siblings) siblings.push(obj)
    else byParent.set(key, [obj])
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.zIndex - b.zIndex)
  }
  return byParent
}

/** Builds the hierarchical read-model tree, root nodes first, ascending zIndex within siblings. */
export function buildTree(objects: SceneObject[]): LayerTreeNode[] {
  const byParent = groupByParent(objects)

  function build(obj: SceneObject, depth: number): LayerTreeNode {
    const childObjects = depth >= MAX_DEPTH ? [] : (byParent.get(obj.id) ?? [])
    return {
      id: obj.id,
      kind: kindOf(obj),
      objectType: obj.type,
      name: obj.name,
      parentId: obj.parentId ?? null,
      children: childObjects.map(child => build(child, depth + 1)),
      expanded: obj.expanded ?? true,
      visible: obj.visible,
      locked: obj.locked,
      opacity: obj.opacity,
      blendMode: obj.blendMode,
      object: obj,
    }
  }

  const roots = byParent.get(null) ?? []
  return roots.map(obj => build(obj, 0))
}

/**
 * Why: rendering order must be a DFS pre-order over the tree (a group
 * occupies one z-slot among its siblings; everything inside it paints
 * within that slot). Returns leaf ids only — folders/groups are
 * organizational/bounding-box-only and are never drawn directly.
 */
export function buildPaintOrder(objects: SceneObject[]): string[] {
  const tree = buildTree(objects)
  const order: string[] = []
  function visit(node: LayerTreeNode): void {
    if (node.kind === 'leaf') {
      order.push(node.id)
      return
    }
    for (const child of node.children) visit(child)
  }
  for (const root of tree) visit(root)
  return order
}

/**
 * Why: the layer panel displays top-of-stack first (matches the existing
 * flat panel's `[...objectsByZIndex].reverse()` convention) and must skip
 * descendants of a collapsed folder/group. Used for shift-range selection
 * and arrow-key navigation, where "range" means contiguous in this
 * on-screen order, not raw array order.
 */
export function flattenVisible(objects: SceneObject[]): string[] {
  const tree = buildTree(objects)
  const order: string[] = []
  function visit(node: LayerTreeNode): void {
    order.push(node.id)
    if ((node.kind === 'group' || node.kind === 'folder') && node.expanded === false) return
    for (const child of [...node.children].reverse()) visit(child)
  }
  for (const root of [...tree].reverse()) visit(root)
  return order
}

/** [self, parent, grandparent, ...] — stops at root or on a cyclic loop back to an already-seen id. */
function ancestorChain(objects: SceneObject[], id: string): SceneObject[] {
  const byId = new Map(objects.map(o => [o.id, o]))
  const chain: SceneObject[] = []
  const seen = new Set<string>()
  let current = byId.get(id)
  while (current) {
    chain.push(current)
    seen.add(current.id)
    const parentId = current.parentId ?? null
    if (parentId === null || seen.has(parentId)) break
    current = byId.get(parentId)
  }
  return chain
}

export function getEffectiveVisibility(objects: SceneObject[], id: string): boolean {
  return ancestorChain(objects, id).every(o => o.visible)
}

export function getEffectiveLocked(objects: SceneObject[], id: string): boolean {
  return ancestorChain(objects, id).some(o => o.locked)
}

/** effectiveOpacity = object.opacity * parent.opacity * grandparent.opacity ..., clamped [0, 1]. */
export function getEffectiveOpacity(objects: SceneObject[], id: string): number {
  const raw = ancestorChain(objects, id).reduce((acc, o) => acc * o.opacity, 1)
  return Math.min(1, Math.max(0, raw))
}

/** Nearest defined blendMode walking self → ancestors; undefined falls back to 'normal' at the render site. */
export function getEffectiveBlendMode(objects: SceneObject[], id: string): BlendMode | undefined {
  for (const o of ancestorChain(objects, id)) {
    if (o.blendMode) return o.blendMode
  }
  return undefined
}

/** Outermost 'group' ancestor of id (including id itself if it is a group), or null if none. */
export function getOutermostGroup(objects: SceneObject[], id: string): string | null {
  const chain = ancestorChain(objects, id)
  let outermost: string | null = null
  for (const o of chain) {
    if (o.type === 'group') outermost = o.id
  }
  return outermost
}
