// src/commands/CommandRegistry.ts
// Module 18 — central command registry

import { fuzzySearch } from './fuzzySearch'
import type { PaletteCommand, CommandSearchResult } from './types'

export class CommandRegistry {
  private commands = new Map<string, PaletteCommand>()

  /**
   * Why: registering by id means re-registering the same command
   * (e.g. on hot reload) safely replaces the old one rather than
   * creating duplicates in the palette.
   */
  register(command: PaletteCommand): void {
    this.commands.set(command.id, command)
  }

  registerMany(commands: PaletteCommand[]): void {
    commands.forEach(cmd => this.register(cmd))
  }

  unregister(id: string): void {
    this.commands.delete(id)
  }

  get(id: string): PaletteCommand | undefined {
    return this.commands.get(id)
  }

  getAll(): PaletteCommand[] {
    return Array.from(this.commands.values())
  }

  /**
   * Why: delegates to fuzzySearch so the registry is the single
   * entry point for both storage and retrieval. The palette store
   * never needs to import fuzzySearch directly.
   * Inputs: query string (can be empty — returns all commands).
   * Output: scored, sorted results.
   * Called by: command palette Pinia store's filtered getter.
   */
  search(query: string): CommandSearchResult[] {
    return fuzzySearch(query, this.getAll())
  }

  execute(id: string): void {
    const cmd = this.commands.get(id)
    if (!cmd) {
      console.warn(`[CommandRegistry] Command not found: ${id}`)
      return
    }
    console.log(`[CommandRegistry] Executing: ${cmd.label}`)
    Promise.resolve(cmd.handler()).catch(err =>
      console.error(`[CommandRegistry] Command error: ${id}`, err)
    )
  }

  get size(): number { return this.commands.size }
}

// Singleton — shared across the entire app
export const commandRegistry = new CommandRegistry()