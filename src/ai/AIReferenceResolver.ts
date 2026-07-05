// src/ai/AIReferenceResolver.ts
// AI Workflow — deterministic object-reference resolution against a
// read-only AIEditorContext. Never guesses silently: an ambiguous or
// empty resolution always returns a warning alongside its best-effort
// id list, so the plan builder can flag the plan as requiring
// confirmation instead of the executor silently touching the wrong
// objects.

import type { AIContextObject, AIEditorContext } from './planTypes'
import type { SceneObjectType } from '../engine/scene-graph/types'

export interface AIReferenceResult {
  ids: string[]
  warning?: string
}

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
}

/** Exported so AIPromptParser can reuse the same shape-name vocabulary for `create` entity extraction. */
export function inferObjectTypeFromPhrase(phrase: string): SceneObjectType | undefined {
  if (/\b(rect|rectangles?|squares?|boxe?s?)\b/.test(phrase)) return 'rectangle'
  if (/\b(ellipses?|circles?|ovals?)\b/.test(phrase)) return 'ellipse'
  if (/\b(texts?|labels?|headings?|titles?)\b/.test(phrase)) return 'text'
  if (/\b(images?|pictures?|photos?)\b/.test(phrase)) return 'image'
  if (/\bgroups?\b/.test(phrase)) return 'group'
  if (/\bfolders?\b/.test(phrase)) return 'folder'
  return undefined
}

function extractOrdinal(phrase: string): number | 'last' | undefined {
  if (/\blast\b/.test(phrase)) return 'last'
  for (const [word, n] of Object.entries(ORDINAL_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(phrase)) return n
  }
  const numMatch = phrase.match(/\b(\d+)(?:st|nd|rd|th)\b/)
  if (numMatch?.[1]) return parseInt(numMatch[1], 10)
  return undefined
}

function ordinalWord(n: number): string {
  const words = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
  return words[n] ?? `${n}th`
}

function objectIntersectsViewport(o: AIContextObject, vp: AIEditorContext['viewport']): boolean {
  return o.x < vp.right && o.x + o.width > vp.left && o.y < vp.bottom && o.y + o.height > vp.top
}

function area(o: AIContextObject): number {
  return Math.max(0, o.width) * Math.max(0, o.height)
}

/** Case-insensitive equality/substring match against known object names — handles "the logo"/"the background" without an explicit "named"/"called" keyword. */
function resolveByBareName(phrase: string, context: AIEditorContext): AIContextObject | undefined {
  const exact = context.objects.find(o => o.name.trim().toLowerCase() === phrase.trim().toLowerCase())
  if (exact) return exact
  const candidates = context.objects.filter(o => o.name.length > 2 && phrase.includes(o.name.toLowerCase()))
  if (candidates.length === 1) return candidates[0]
  return undefined
}

export function resolveReference(phraseRaw: string, context: AIEditorContext): AIReferenceResult {
  const phrase = phraseRaw.trim().toLowerCase()

  if (!phrase) {
    return context.selectedObjectIds.length > 0
      ? { ids: [...context.selectedObjectIds] }
      : { ids: [], warning: 'No object is currently selected.' }
  }

  // Checked before the selected/current check below: "the current
  // viewport" contains the word "current", which would otherwise be
  // misread as "current [selection]".
  if (/\bviewport\b/.test(phrase) || /\bvisible area\b/.test(phrase)) {
    const matches = context.objects.filter(o => objectIntersectsViewport(o, context.viewport))
    return matches.length ? { ids: matches.map(o => o.id) } : { ids: [], warning: 'No objects are within the current viewport.' }
  }

  if (/\bselected\b/.test(phrase) || /\bcurrent\s+(?:object|selection)\b/.test(phrase)) {
    if (context.selectedObjectIds.length === 0) {
      return { ids: [], warning: 'No object is currently selected.' }
    }
    return { ids: [...context.selectedObjectIds] }
  }

  const namedMatch = phrase.match(/(?:named|called)\s+["']?([a-z0-9 _-]+?)["']?(?:\.|$|\s+(?:above|below|to|and|then)\b)/i)
  if (namedMatch?.[1]) {
    const name = namedMatch[1].trim()
    const matches = context.objects.filter(o => o.name.toLowerCase() === name)
    if (matches.length === 0) return { ids: [], warning: `No object named "${name}" was found.` }
    if (matches.length > 1) {
      return { ids: matches.map(o => o.id), warning: `Multiple objects are named "${name}" — affecting all of them.` }
    }
    return { ids: [matches[0]!.id] }
  }

  const typeFromPhrase = inferObjectTypeFromPhrase(phrase)

  if (/\ball\b/.test(phrase) || /\bevery\b/.test(phrase)) {
    if (/\bvisible\b/.test(phrase)) {
      const matches = context.objects.filter(o => o.visible)
      return matches.length ? { ids: matches.map(o => o.id) } : { ids: [], warning: 'No visible objects were found.' }
    }
    if (/\bunlocked\b/.test(phrase)) {
      const matches = context.objects.filter(o => !o.locked)
      return matches.length ? { ids: matches.map(o => o.id) } : { ids: [], warning: 'No unlocked objects were found.' }
    }
    if (typeFromPhrase) {
      const matches = context.objects.filter(o => o.type === typeFromPhrase)
      return matches.length ? { ids: matches.map(o => o.id) } : { ids: [], warning: `No ${typeFromPhrase} objects were found.` }
    }
    if (/\bobjects?\b/.test(phrase) || phrase.trim() === 'all') {
      return context.objects.length ? { ids: context.objects.map(o => o.id) } : { ids: [], warning: 'The canvas is empty.' }
    }
  }

  if (/\b(largest|biggest)\b/.test(phrase)) {
    const pool = typeFromPhrase ? context.objects.filter(o => o.type === typeFromPhrase) : context.objects
    if (pool.length === 0) return { ids: [], warning: 'No matching objects were found.' }
    const largest = pool.reduce((a, b) => (area(a) >= area(b) ? a : b))
    return { ids: [largest.id] }
  }
  if (/\bsmallest\b/.test(phrase)) {
    const pool = typeFromPhrase ? context.objects.filter(o => o.type === typeFromPhrase) : context.objects
    if (pool.length === 0) return { ids: [], warning: 'No matching objects were found.' }
    const smallest = pool.reduce((a, b) => (area(a) <= area(b) ? a : b))
    return { ids: [smallest.id] }
  }

  const ordinal = extractOrdinal(phrase)
  if (ordinal !== undefined) {
    const pool = (typeFromPhrase ? context.objects.filter(o => o.type === typeFromPhrase) : context.objects)
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
    if (pool.length === 0) return { ids: [], warning: 'No matching objects were found.' }
    const index = ordinal === 'last' ? pool.length - 1 : ordinal - 1
    const target = pool[index]
    if (!target) {
      const label = ordinal === 'last' ? 'last' : ordinalWord(ordinal)
      return { ids: [], warning: `There is no ${label} matching object — only ${pool.length} found.` }
    }
    return { ids: [target.id] }
  }

  const byName = resolveByBareName(phrase, context)
  if (byName) return { ids: [byName.id] }

  if (typeFromPhrase) {
    const matches = context.objects.filter(o => o.type === typeFromPhrase)
    if (matches.length === 0) return { ids: [], warning: `No ${typeFromPhrase} objects were found.` }
    if (matches.length > 1) {
      return {
        ids: matches.map(o => o.id),
        warning: `There are ${matches.length} ${typeFromPhrase} objects — the reference is ambiguous, affecting all of them. Be more specific (e.g. "the first ${typeFromPhrase}") to target just one.`,
      }
    }
    return { ids: [matches[0]!.id] }
  }

  // Nothing specific was recognized in the phrase at all (no type word,
  // no "all", no name, no ordinal/largest/smallest/viewport) — common
  // natural phrasing like "change color to red" leaves the target
  // implicit, meaning "the current selection" (matches the pre-existing
  // simple parser's `target ?? 'selected'` convention). This is distinct
  // from a SPECIFIC reference that just didn't match anything (e.g. "the
  // rectangle" with none on the canvas), which is handled above and
  // still returns its own honest warning rather than silently
  // substituting the selection.
  if (context.selectedObjectIds.length > 0) {
    return { ids: [...context.selectedObjectIds] }
  }

  return { ids: [], warning: `Could not resolve the object reference "${phraseRaw.trim()}".` }
}
