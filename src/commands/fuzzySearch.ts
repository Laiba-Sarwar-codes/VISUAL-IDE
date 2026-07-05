// src/commands/fuzzySearch.ts
// Module 18 — fuzzy search for command palette

import type { PaletteCommand, CommandSearchResult } from './types'

/**
 * Why: a simple substring match would miss 'crrect' matching 'create rect'.
 * Fuzzy search lets users type partial letters in order and still find
 * the right command, matching VS Code palette behavior.
 * Inputs: query string, full command list.
 * Output: scored, sorted results with score > 0.
 * Called by: command palette store's filtered getter.
 */
export function fuzzySearch(
  query: string,
  commands: PaletteCommand[]
): CommandSearchResult[] {
  const q = query.trim().toLowerCase()

  if (!q) {
    // No query — return all commands with equal score, sorted by category
    return commands
      .map(command => ({ command, score: 1 }))
      .sort((a, b) =>
        a.command.category.localeCompare(b.command.category) ||
        a.command.label.localeCompare(b.command.label)
      )
  }

  const results: CommandSearchResult[] = []

  for (const command of commands) {
    const score = scoreCommand(q, command)
    if (score > 0) results.push({ command, score })
  }

  return results.sort((a, b) => b.score - a.score)
}

/**
 * Why: different match types have different weights. An exact label
 * match should rank higher than a match in keywords. Scoring lets us
 * put the most relevant result at the top automatically.
 */
function scoreCommand(query: string, command: PaletteCommand): number {
  const label       = command.label.toLowerCase()
  const description = (command.description ?? '').toLowerCase()
  const category    = command.category.toLowerCase()
  const keywords    = (command.keywords ?? []).join(' ').toLowerCase()

  // Exact match on label — highest score
  if (label === query) return 100

  // Label starts with query
  if (label.startsWith(query)) return 80

  // Label contains query as substring
  if (label.includes(query)) return 60

  // Fuzzy: all query characters appear in label in order
  if (fuzzyMatch(query, label)) return 40

  // Match in description or keywords
  if (description.includes(query) || keywords.includes(query)) return 20

  // Match in category
  if (category.includes(query)) return 10

  return 0
}

/**
 * Why: checks if every character in the query appears in the target
 * string in the same order (but not necessarily contiguous).
 * e.g. query 'crect' matches 'create rectangle' because c-r-e-c-t
 * all appear in order.
 */
function fuzzyMatch(query: string, target: string): boolean {
  let qi = 0
  for (let i = 0; i < target.length && qi < query.length; i++) {
    if (target[i] === query[qi]) qi++
  }
  return qi === query.length
}