// app/stores/selection.ts
// Module 6 — reactive selection state for all UI components
// Layer Management — extended with multi-select (selectedIds). selectedId
// stays as the "primary" (last-affected) selection so every pre-existing
// single-select caller (InspectorPanel, PluginContext, OperationExecutor,
// builtInCommands, monitoring store) keeps working unmodified.

import { defineStore } from 'pinia'
import { useSceneStore } from './scene'
import type { SceneObject } from '~~/src/engine/scene-graph/types'

interface SelectionState {
  selectedId: string | null
  selectedIds: string[]
}

export const useSelectionStore = defineStore('selection', {
  state: (): SelectionState => ({
    selectedId: null,
    selectedIds: [],
  }),

  getters: {
    /**
     * Why: every component wants the full SceneObject, not just the id.
     * Centralising the scene lookup here means no component imports
     * both stores and calls find() itself.
     * Called by: InspectorPanel, LayerPanel, CanvasWorkspace.
     */
    selectedObject(state): SceneObject | null {
      if (!state.selectedId) return null
      const scene = useSceneStore()
      return scene.objects.find((o) => o.id === state.selectedId) ?? null
    },

    /** Full multi-selection resolved to SceneObjects (missing ids silently dropped). */
    selectedObjects(state): SceneObject[] {
      const scene = useSceneStore()
      const byId = new Map(scene.objects.map(o => [o.id, o]))
      return state.selectedIds
        .map(id => byId.get(id))
        .filter((o): o is SceneObject => o !== undefined)
    },

    isSelected(state): (id: string) => boolean {
      return (id: string) => state.selectedIds.includes(id)
    },
  },

  actions: {
    /** Replaces the entire selection with a single id (or clears if null). Unchanged signature/behavior. */
    select(id: string | null): void {
      this.selectedId = id
      this.selectedIds = id ? [id] : []
    },

    clear(): void {
      this.selectedId = null
      this.selectedIds = []
    },

    /**
     * Why: "clicking a selected object should not clear the rest of the
     * selection unnecessarily" — plain-clicking a member already inside
     * the current multi-selection just makes it primary, without
     * touching selectedIds. No-ops if id isn't currently selected.
     */
    makePrimary(id: string): void {
      if (this.selectedIds.includes(id)) this.selectedId = id
    },

    /**
     * Why: shift-click semantics — toggling an id in/out of the current
     * multi-selection. The most-recently-toggled-in id becomes primary;
     * toggling the primary id out promotes the new last-remaining id.
     */
    toggleSelect(id: string): void {
      const idx = this.selectedIds.indexOf(id)
      if (idx === -1) {
        this.selectedIds.push(id)
        this.selectedId = id
      } else {
        this.selectedIds.splice(idx, 1)
        this.selectedId = this.selectedIds.at(-1) ?? null
      }
    },

    /** Replaces the whole selection with an ordered id list (layer-panel shift-range-select). */
    selectRange(ids: string[]): void {
      this.selectedIds = [...ids]
      this.selectedId = ids.at(-1) ?? null
    },

    /** Ctrl/Cmd+A — selects every eligible (visible, unlocked) object in the scene. */
    selectAll(): void {
      const scene = useSceneStore()
      const ids = scene.objects
        .filter(o => o.visible && !o.locked && o.type !== 'folder')
        .map(o => o.id)
      this.selectedIds = ids
      this.selectedId = ids.at(-1) ?? null
    },

    /**
     * Why: delete must clear selection and remove the object(s) atomically
     * so the inspector never briefly shows a stale selected object that
     * no longer exists in the scene. Extended to remove the whole
     * multi-selection — for the pre-existing single-select call sites this
     * is exactly the old single-object behavior since selectedIds has at
     * most one entry in that case.
     * Called by: CanvasWorkspace keyboard handler (Chunk 2).
     */
    deleteSelected(): void {
      if (this.selectedIds.length === 0) return
      const scene = useSceneStore()
      if (this.selectedIds.length === 1) {
        scene.removeObject(this.selectedIds[0]!)
      } else {
        scene.removeObjects(this.selectedIds)
      }
      this.selectedId = null
      this.selectedIds = []
    },
  },
})