// app/stores/history.ts
// Module 8 fixed — registers onRecord callback to avoid circular import

import { defineStore } from 'pinia'
import { historyManager } from '~~/src/engine/history/HistoryManager'
import { useEditorStore } from './editor'

interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoLabel: string | null
  redoLabel: string | null
  stackSize: number
}

export const useHistoryStore = defineStore('history', {
  state: (): HistoryState => ({
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
    stackSize: 0,
  }),

  actions: {
    /**
     * Why: called once when the history store first initializes.
     * Registers a callback on the HistoryManager singleton so any call
     * to historyManager.record() (from scene.ts) automatically syncs
     * this store's reactive state — without scene.ts ever importing
     * this store.
     */
    init(): void {
      historyManager.setOnRecord(() => this.sync())
    },

    sync(): void {
      this.canUndo = historyManager.canUndo
      this.canRedo = historyManager.canRedo
      this.undoLabel = historyManager.undoLabel
      this.redoLabel = historyManager.redoLabel
      this.stackSize = historyManager.stackSize
    },

    undo(): void {
      const label = historyManager.undo()
      this.sync()
      if (label) useEditorStore().setStatusMessage(`Undo: ${label}`)
    },

    redo(): void {
      const label = historyManager.redo()
      this.sync()
      if (label) useEditorStore().setStatusMessage(`Redo: ${label}`)
    },

    clear(): void {
      historyManager.clear()
      this.sync()
    },
  },
})