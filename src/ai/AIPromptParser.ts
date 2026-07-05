// src/ai/AIPromptParser.ts
// AI Workflow — modular multi-step prompt parser producing ParsedStep[].
// Distinct from (and does not replace) the pre-existing `InstructionParser.ts`,
// which stays untouched and keeps backing the original simple pipeline.
// This parser covers a broader instruction vocabulary (move/resize/rotate/
// duplicate/align/distribute/group/reorder/visibility/lock/rename/select,
// plus multi-step splitting) — pattern-based, not exact-sentence matching,
// so reasonable synonyms and word-order variations are supported.
//
// Kept intentionally free of Pinia/DOM imports — this and everything it
// calls only touches plain strings, so it's safe to run unchanged on the
// main thread or inside a Web Worker (see AIWorkerClient.ts).

import { inferObjectTypeFromPhrase } from './AIReferenceResolver'
import type { ParsedStep } from './planTypes'

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  yellow: '#eab308', orange: '#f97316', purple: '#8b5cf6',
  pink: '#ec4899', white: '#ffffff', black: '#000000',
  gray: '#6b7280', grey: '#6b7280', cyan: '#06b6d4',
}

const BLEND_MODE_WORDS: Record<string, string> = {
  normal: 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
  darken: 'darken', lighten: 'lighten',
  'color dodge': 'color-dodge', 'color-dodge': 'color-dodge', dodge: 'color-dodge',
  'color burn': 'color-burn', 'color-burn': 'color-burn', burn: 'color-burn',
  'hard light': 'hard-light', 'hard-light': 'hard-light',
  'soft light': 'soft-light', 'soft-light': 'soft-light',
  difference: 'difference', exclusion: 'exclusion',
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

/**
 * Why: splits on "," / " and " / " then " so multi-step instructions like
 * "select all circles, align them at the top and distribute them
 * horizontally" become 3 independently-parsed steps, preserving order.
 */
export function splitSteps(text: string): string[] {
  return text
    .split(/\s*(?:,\s*(?:and\s+)?|\s+and\s+|\s+then\s+)\s*/i)
    .map(s => s.trim())
    .filter(Boolean)
}

export function parsePrompt(raw: string): ParsedStep[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  return splitSteps(trimmed).map(parseStep)
}

function extractColor(text: string): string | undefined {
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return hex
  }
  const hexMatch = text.match(/#([0-9a-fA-F]{3,6})\b/)
  return hexMatch?.[0]
}

function extractBlendMode(text: string): ParsedStep['blendMode'] {
  for (const [word, mode] of Object.entries(BLEND_MODE_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return mode as ParsedStep['blendMode']
  }
  return undefined
}

function extractCount(text: string): number {
  const digitMatch = text.match(/\b(\d+)\b/)
  if (digitMatch?.[1]) return Math.min(parseInt(digitMatch[1], 10), 20)
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return num
  }
  return 1
}

function extractTextContent(text: string): string | undefined {
  const quoted = text.match(/["']([^"']+)["']/)
  if (quoted?.[1]) return quoted[1]
  const saying = text.match(/\b(?:saying|with text|labeled?|called?)\s+(.+)/i)
  return saying?.[1]?.trim()
}

function extractPercentOrFraction(text: string): number {
  const percent = text.match(/(\d+(?:\.\d+)?)\s*%/)
  if (percent?.[1]) return Math.min(1, Math.max(0, parseFloat(percent[1]) / 100))
  const fraction = text.match(/\b(0?\.\d+|1(?:\.0+)?)\b/)
  if (fraction?.[1]) return Math.min(1, Math.max(0, parseFloat(fraction[1])))
  return 0.5
}

function extractEdge(text: string): ParsedStep['edge'] {
  if (/\bleft\b/.test(text)) return 'left'
  if (/\bright\b/.test(text)) return 'right'
  if (/\btop\b/.test(text)) return 'top'
  if (/\bbottom\b/.test(text)) return 'bottom'
  if (/\b(center|centre|middle)\b/.test(text) && /\bvert/.test(text)) return 'vcenter'
  if (/\b(center|centre|middle)\b/.test(text)) return 'hcenter'
  return 'left'
}

function extractDegrees(text: string): number {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*(?:deg|degrees?)?/)
  return match?.[1] ? parseFloat(match[1]) : 90
}

const NAMED_MATCH = /(?:named|called)\s+["']?([a-z0-9 _-]+?)["']?(?:\.|$|\s+(?:above|below|to|and|then)\b)/i

function extractNewName(text: string): string | undefined {
  const toMatch = text.match(/\brename\b.*?\bto\s+["']?([a-zA-Z0-9 _-]+?)["']?\s*$/i)
  if (toMatch?.[1]) return toMatch[1].trim()
  const named = text.match(NAMED_MATCH)
  return named?.[1]?.trim()
}

function parseMove(text: string): Partial<ParsedStep> {
  if (/\b(center|centre)\b/.test(text)) {
    return { moveMode: 'center' }
  }
  const relMatch = text.match(/\bmove\s+(.+?)\s+(above|below|left of|right of)\s+(.+)$/i)
  if (relMatch?.[2] && relMatch?.[3]) {
    const directionRaw = relMatch[2].toLowerCase().replace(' ', '-')
    return {
      moveMode: 'relative-anchor',
      anchorDirection: directionRaw as ParsedStep['anchorDirection'],
      anchorPhrase: relMatch[3].trim(),
    }
  }
  const dirMatch = text.match(/\b(left|right|up|down)\b/i)
  const amountMatch = text.match(/\bby\s+(\d+(?:\.\d+)?)\b/i)
  const amount = amountMatch?.[1] ? parseFloat(amountMatch[1]) : 40
  if (dirMatch?.[1]) {
    const dir = dirMatch[1].toLowerCase()
    return {
      moveMode: 'delta',
      moveDx: dir === 'left' ? -amount : dir === 'right' ? amount : 0,
      moveDy: dir === 'up' ? -amount : dir === 'down' ? amount : 0,
    }
  }
  return { moveMode: 'center' }
}

function parseStep(rawStep: string): ParsedStep {
  const raw = rawStep.trim()
  const text = raw.toLowerCase()
  const base: ParsedStep = { raw, intent: 'unknown', referencePhrase: raw }

  if (/\brename\b/.test(text)) {
    return { ...base, intent: 'rename', newName: extractNewName(raw) }
  }
  if (/\bungroup\b/.test(text)) return { ...base, intent: 'ungroup' }
  if (/\bgroup\b/.test(text)) return { ...base, intent: 'group' }

  if (/\balign\b/.test(text)) return { ...base, intent: 'align', edge: extractEdge(text) }
  if (/\bdistribute\b/.test(text)) {
    return { ...base, intent: 'distribute', axis: /\bvert/.test(text) ? 'vertical' : 'horizontal' }
  }

  if (/\bbring\b.*\bfront\b/.test(text)) return { ...base, intent: 'reorder', direction: 'front' }
  if (/\bsend\b.*\bback\b/.test(text)) return { ...base, intent: 'reorder', direction: 'back' }
  if (/\bforward\b/.test(text)) return { ...base, intent: 'reorder', direction: 'forward' }
  if (/\bbackward\b/.test(text)) return { ...base, intent: 'reorder', direction: 'backward' }

  if (/\bhide\b/.test(text)) return { ...base, intent: 'set-visibility', visibilityValue: false }
  if (/\b(show|unhide)\b/.test(text)) return { ...base, intent: 'set-visibility', visibilityValue: true }

  if (/\bunlock\b/.test(text)) return { ...base, intent: 'set-lock', lockValue: false }
  if (/\block\b/.test(text)) return { ...base, intent: 'set-lock', lockValue: true }

  if (/\bopacity\b|\btransparen/i.test(text)) {
    return { ...base, intent: 'set-opacity', opacityValue: extractPercentOrFraction(text) }
  }

  const blendMode = extractBlendMode(text)
  if (blendMode && /\bblend\b/.test(text)) {
    return { ...base, intent: 'set-blend-mode', blendMode }
  }

  // Deliberately NOT matching bare "copy" here — "move the copy right"
  // (a later step referring back to a just-duplicated object) uses
  // "copy" as a noun, not a verb, and must not be misread as a new
  // duplicate instruction.
  if (/\b(duplicate|clone)\b/.test(text)) {
    return { ...base, intent: 'duplicate' }
  }

  if (/\bselect\b/.test(text)) return { ...base, intent: 'select' }

  if (/\b(delete|remove|erase)\b/.test(text)) return { ...base, intent: 'delete' }

  if (/\b(width|height|wider|narrower|taller|shorter)\b/.test(text) && /\b(increase|decrease|make|set|reduce)\b/.test(text)) {
    const property: 'width' | 'height' = /\bheight\b|\btaller\b|\bshorter\b/.test(text) ? 'height' : 'width'
    const numMatch = text.match(/\bby\s+(\d+(?:\.\d+)?)\b/) ?? text.match(/\b(\d+(?:\.\d+)?)\s*(?:px|units?)?\b/)
    const decreasing = /\b(decrease|reduce|narrower|shorter)\b/.test(text)
    const magnitude = numMatch?.[1] ? parseFloat(numMatch[1]) : 40
    return {
      ...base,
      intent: 'resize',
      resizeProperty: property,
      resizeDelta: decreasing ? -magnitude : magnitude,
      resizeRelative: true,
    }
  }

  if (/\brotate\b/.test(text)) {
    return { ...base, intent: 'rotate', rotateDegrees: extractDegrees(text) }
  }

  if (/\bmove\b|\b(center|centre)\b/.test(text)) {
    return { ...base, intent: 'move', ...parseMove(text) }
  }

  const color = extractColor(text)
  if (color && /\b(make|set|change|turn|color|colour|fill)\b/.test(text)) {
    return { ...base, intent: 'set-color', color }
  }

  if (/\b(create|add|draw|insert|place)\b/.test(text)) {
    return {
      ...base,
      intent: 'create',
      objectType: inferObjectTypeFromPhrase(text) ?? 'rectangle',
      count: extractCount(text),
      color,
      text: extractTextContent(raw),
    }
  }

  return base
}
