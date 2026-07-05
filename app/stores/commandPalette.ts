// app/stores/commandPalette.ts
// Module 18 — reactive command palette state

import { defineStore } from 'pinia'
import { commandRegistry } from '~~/src/commands/CommandRegistry'
import type { CommandSearchResult } from '~~/src/commands/types'

interface CommandPaletteState {
  isOpen: boolean
  query: string
  activeIndex: number
  results: CommandSearchResult[]
}

export const useCommandPaletteStore = defineStore('commandPalette', {
  state: (): CommandPaletteState => ({
    isOpen: false,
    query: '',
    activeIndex: 0,
    results: [],
  }),

  getters: {
    activeCommand: (state): CommandSearchResult | null =>
      state.results[state.activeIndex] ?? null,

    hasResults: (state): boolean => state.results.length > 0,
  },

  actions: {
    open(): void {
      this.isOpen = true
      this.query = ''
      this.activeIndex = 0
      this.results = commandRegistry.search('')
    },

    close(): void {
      this.isOpen = false
      this.query = ''
      this.activeIndex = 0
      this.results = []
    },

    toggle(): void {
      this.isOpen ? this.close() : this.open()
    },

    /**
     * Why: re-runs search on every keystroke and resets activeIndex
     * to 0 so the first result is always highlighted after typing.
     */
    setQuery(query: string): void {
      this.query = query
      this.activeIndex = 0
      this.results = commandRegistry.search(query)
    },

    moveUp(): void {
      if (this.activeIndex > 0) this.activeIndex--
    },

    moveDown(): void {
      if (this.activeIndex < this.results.length - 1) this.activeIndex++
    },

    /**
     * Why: executes the currently highlighted command and immediately
     * closes the palette so the user sees the result right away.
     */
    executeActive(): void {
      const result = this.activeCommand
      if (!result) return
      this.close()
      commandRegistry.execute(result.command.id)
    },
  },
})