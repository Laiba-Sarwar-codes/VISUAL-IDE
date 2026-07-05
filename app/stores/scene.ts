// app/stores/scene.ts
// Module 8 fixed — no require, no circular import
// Layer Management — added folder/group/reparent/align/distribute/blend-
// mode actions, all following the existing withoutRecording + single
// historyManager.record() pattern already used by the reorder actions
// (full-array snapshot before/after = one undo step for a multi-object op).

import { defineStore } from 'pinia'
import { nanoid } from 'nanoid'
import { createSceneObject } from '~~/src/engine/scene-graph/createSceneObject'
import { LayerManager } from '~~/src/engine/layers/LayerManager'
import { historyManager } from '~~/src/engine/history/HistoryManager'
import * as LayerHierarchyService from '~~/src/layers/LayerHierarchyService'
import * as LayerGroupingService from '~~/src/layers/LayerGroupingService'
import * as LayerAlignmentService from '~~/src/layers/LayerAlignmentService'
import type { CreateSceneObjectInput, SceneObject } from '~~/src/engine/scene-graph/types'
import type { BlendMode } from '~~/src/layers/types'

let _recording = true

interface SceneState { objects: SceneObject[] }

export const useSceneStore = defineStore('scene', {
  state: (): SceneState => ({ objects: [] }),

  getters: {
    objectsByZIndex(state): SceneObject[] {
      return [...state.objects].sort((a, b) => a.zIndex - b.zIndex)
    },
  },

  actions: {
    _addRaw(obj: SceneObject): void { this.objects.push(obj) },
    _removeRaw(id: string): void { this.objects = this.objects.filter(o => o.id !== id) },
    _updateRaw(id: string, changes: Partial<SceneObject>): void {
      const t = this.objects.find(o => o.id === id)
      if (t) Object.assign(t, changes)
    },
    _setAllRaw(objects: SceneObject[]): void { this.objects = objects },

    addObject(input: CreateSceneObjectInput): SceneObject {
      const obj = createSceneObject(input, this.objects.length)
      this._addRaw(obj)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:create',
          timestamp: Date.now(), label: `Create ${obj.name}`,
          before: null, after: obj,
          apply: () => { withoutRecording(() => this._addRaw(obj)) },
          revert: () => { withoutRecording(() => this._removeRaw(obj.id)) },
        })
      }
      return obj
    },

    /**
     * Why: deleting a 'group' cascades to its descendants (real visual
     * composition — see LayerGroupingService), while a plain leaf is
     * removed exactly as before. Folders never cascade here — they're
     * deleted via the dedicated deleteFolder action (promote-children).
     */
    removeObject(id: string): void {
      const obj = this.objects.find(o => o.id === id)
      if (!obj) return

      const expandedIds = LayerGroupingService.expandDeletionForGroups(this.objects, [id])
      if (expandedIds.length > 1) {
        this.removeObjects(expandedIds)
        return
      }

      const snapshot = { ...obj }
      this._removeRaw(id)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:delete',
          timestamp: Date.now(), label: `Delete ${snapshot.name}`,
          before: snapshot, after: null,
          apply: () => { withoutRecording(() => this._removeRaw(id)) },
          revert: () => { withoutRecording(() => this._addRaw(snapshot)) },
        })
      }
    },

    /** Batched multi-object delete — one history entry regardless of count. Cascades group deletions. */
    removeObjects(ids: string[]): void {
      const expandedIds = LayerGroupingService.expandDeletionForGroups(this.objects, ids)
      const idSet = new Set(expandedIds)
      const existing = this.objects.filter(o => idSet.has(o.id))
      if (existing.length === 0) return

      const prev = this.objects.map(o => ({ ...o }))
      this._setAllRaw(this.objects.filter(o => !idSet.has(o.id)))
      const next = this.objects.map(o => ({ ...o }))
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:delete',
          timestamp: Date.now(),
          label: existing.length === 1 ? `Delete ${existing[0]!.name}` : `Delete ${existing.length} objects`,
          before: prev, after: next,
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    updateObject(id: string, changes: Partial<SceneObject>): void {
      const obj = this.objects.find(o => o.id === id)
      if (!obj) return
      const before = { x: obj.x, y: obj.y }
      this._updateRaw(id, changes)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:move',
          timestamp: Date.now(), label: `Move ${obj.name}`,
          before, after: changes,
          apply: () => { withoutRecording(() => this._updateRaw(id, changes)) },
          revert: () => { withoutRecording(() => this._updateRaw(id, before)) },
        })
      }
    },

    toggleVisibility(id: string): void {
      const obj = this.objects.find(o => o.id === id)
      if (!obj) return
      const before = obj.visible
      obj.visible = !obj.visible
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:visibility',
          timestamp: Date.now(), label: `${before ? 'Hide' : 'Show'} ${obj.name}`,
          before, after: !before,
          apply: () => { withoutRecording(() => this._updateRaw(id, { visible: !before })) },
          revert: () => { withoutRecording(() => this._updateRaw(id, { visible: before })) },
        })
      }
    },

    toggleLocked(id: string): void {
      const obj = this.objects.find(o => o.id === id)
      if (!obj) return
      const before = obj.locked
      obj.locked = !obj.locked
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:lock',
          timestamp: Date.now(), label: `${before ? 'Unlock' : 'Lock'} ${obj.name}`,
          before, after: !before,
          apply: () => { withoutRecording(() => this._updateRaw(id, { locked: !before })) },
          revert: () => { withoutRecording(() => this._updateRaw(id, { locked: before })) },
        })
      }
    },

    setOpacity(id: string, opacity: number): void {
      const obj = this.objects.find(o => o.id === id)
      if (!obj) return
      const before = obj.opacity
      const after = Math.min(1, Math.max(0, opacity))
      obj.opacity = after
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:opacity',
          timestamp: Date.now(), label: `Opacity ${obj.name}`,
          before, after,
          apply: () => { withoutRecording(() => this._updateRaw(id, { opacity: after })) },
          revert: () => { withoutRecording(() => this._updateRaw(id, { opacity: before })) },
        })
      }
    },

    setBlendMode(id: string, blendMode: BlendMode): void {
      const obj = this.objects.find(o => o.id === id)
      if (!obj) return
      const before = obj.blendMode
      const after = blendMode
      this._updateRaw(id, { blendMode: after })
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:blendMode',
          timestamp: Date.now(), label: `Blend Mode: ${obj.name}`,
          before, after,
          apply: () => { withoutRecording(() => this._updateRaw(id, { blendMode: after })) },
          revert: () => { withoutRecording(() => this._updateRaw(id, { blendMode: before })) },
        })
      }
    },

    /** Expand/collapse UI state for a folder/group — not recorded in undo history (not a user-data edit). */
    setExpanded(id: string, expanded: boolean): void {
      withoutRecording(() => this._updateRaw(id, { expanded }))
    },

    bringForward(id: string): void {
      const obj = this.objects.find(o => o.id === id)
      const prev = this.objects.map(o => ({ ...o }))
      this._setAllRaw(LayerManager.bringForward(this.objects, id, obj?.parentId ?? null))
      const next = this.objects.map(o => ({ ...o }))
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:reorder',
          timestamp: Date.now(), label: 'Bring Forward',
          before: prev, after: next,
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    sendBackward(id: string): void {
      const obj = this.objects.find(o => o.id === id)
      const prev = this.objects.map(o => ({ ...o }))
      this._setAllRaw(LayerManager.sendBackward(this.objects, id, obj?.parentId ?? null))
      const next = this.objects.map(o => ({ ...o }))
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:reorder',
          timestamp: Date.now(), label: 'Send Backward',
          before: prev, after: next,
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    bringToFront(id: string): void {
      const obj = this.objects.find(o => o.id === id)
      const prev = this.objects.map(o => ({ ...o }))
      this._setAllRaw(LayerManager.bringToFront(this.objects, id, obj?.parentId ?? null))
      const next = this.objects.map(o => ({ ...o }))
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:reorder',
          timestamp: Date.now(), label: 'Bring to Front',
          before: prev, after: next,
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    sendToBack(id: string): void {
      const obj = this.objects.find(o => o.id === id)
      const prev = this.objects.map(o => ({ ...o }))
      this._setAllRaw(LayerManager.sendToBack(this.objects, id, obj?.parentId ?? null))
      const next = this.objects.map(o => ({ ...o }))
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'object:reorder',
          timestamp: Date.now(), label: 'Send to Back',
          before: prev, after: next,
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    createFolder(name = 'New Folder', parentId: string | null = null): string | null {
      const prev = this.objects.map(o => ({ ...o }))
      const { objects: next, folderId } = LayerHierarchyService.createFolder(this.objects, name, parentId)
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:createFolder',
          timestamp: Date.now(), label: `Create Folder: ${name}`,
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
      return folderId
    },

    renameNode(id: string, name: string): void {
      const prev = this.objects.map(o => ({ ...o }))
      const next = LayerHierarchyService.renameNode(this.objects, id, name)
      if (next === this.objects) return // no-op (blank name)
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:renameNode',
          timestamp: Date.now(), label: `Rename: ${name}`,
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    deleteFolder(folderId: string): void {
      const folder = this.objects.find(o => o.id === folderId)
      if (!folder) return
      const prev = this.objects.map(o => ({ ...o }))
      const next = LayerHierarchyService.deleteFolder(this.objects, folderId)
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:deleteFolder',
          timestamp: Date.now(), label: `Delete Folder: ${folder.name}`,
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    reparent(childId: string, newParentId: string | null, index?: number): void {
      const prev = this.objects.map(o => ({ ...o }))
      const next = LayerHierarchyService.reparent(this.objects, childId, newParentId, index)
      if (next === this.objects) return // rejected (cycle) or no-op
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:reparent',
          timestamp: Date.now(), label: 'Move Layer',
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    /** Applies a precomputed next-objects array (e.g. from LayerDragDropService.computeDrop) as one transaction. */
    applyLayerTreeChange(next: SceneObject[], label: string): void {
      const prev = this.objects.map(o => ({ ...o }))
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:reparent',
          timestamp: Date.now(), label,
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    groupSelected(ids: string[]): string | null {
      const prev = this.objects.map(o => ({ ...o }))
      const { objects: next, groupId } = LayerGroupingService.groupObjects(this.objects, ids)
      if (!groupId) return null
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:group',
          timestamp: Date.now(), label: 'Group Selection',
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
      return groupId
    },

    ungroupSelected(groupId: string): void {
      const group = this.objects.find(o => o.id === groupId)
      if (!group || group.type !== 'group') return
      const prev = this.objects.map(o => ({ ...o }))
      const next = LayerGroupingService.ungroupObjects(this.objects, groupId)
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:ungroup',
          timestamp: Date.now(), label: `Ungroup: ${group.name}`,
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    /** Recomputes a group's cached bbox after its children were moved (e.g. dragging the whole group). */
    recomputeGroupBounds(groupId: string): void {
      withoutRecording(() => {
        this._setAllRaw(LayerGroupingService.recomputeGroupBounds(this.objects, groupId))
      })
    },

    alignSelected(ids: string[], edge: 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter'): void {
      const fn = {
        left: LayerAlignmentService.alignLeft,
        right: LayerAlignmentService.alignRight,
        hcenter: LayerAlignmentService.alignHCenter,
        top: LayerAlignmentService.alignTop,
        bottom: LayerAlignmentService.alignBottom,
        vcenter: LayerAlignmentService.alignVCenter,
      }[edge]
      const prev = this.objects.map(o => ({ ...o }))
      const next = fn(this.objects, ids)
      if (next === this.objects) return
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:align',
          timestamp: Date.now(), label: `Align: ${edge}`,
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },

    distributeSelected(ids: string[], axis: 'horizontal' | 'vertical'): void {
      const fn = axis === 'horizontal'
        ? LayerAlignmentService.distributeHorizontal
        : LayerAlignmentService.distributeVertical
      const prev = this.objects.map(o => ({ ...o }))
      const next = fn(this.objects, ids)
      if (next === this.objects) return
      this._setAllRaw(next)
      if (_recording) {
        historyManager.record({
          id: nanoid(), type: 'layer:distribute',
          timestamp: Date.now(), label: `Distribute: ${axis}`,
          before: prev, after: next.map(o => ({ ...o })),
          apply: () => { withoutRecording(() => this._setAllRaw(next)) },
          revert: () => { withoutRecording(() => this._setAllRaw(prev)) },
        })
      }
    },
  },
})

export function withoutRecording(fn: () => void): void {
  _recording = false
  try { fn() } finally { _recording = true }
}
