// src/commands/types.ts
// Module 18 — Command Palette type definitions

export interface PaletteCommand {
  id: string
  label: string
  description?: string
  category: string        // e.g. 'Scene', 'View', 'History', 'Plugin'
  icon?: string
  keywords?: string[]     // extra search terms beyond label
  shortcut?: string       // display only e.g. 'Cmd+Z'
  handler: () => void | Promise<void>
}

export interface CommandSearchResult {
  command: PaletteCommand
  score: number           // higher = better match
}

export interface CommandPaletteState {
  isOpen: boolean
  query: string
  activeIndex: number
}