// src/ai/InstructionParser.ts
// Module 19 — rule-based natural language parser
// Fixed: parseIntent checks modify before create when targeting existing objects

import type { ParsedInstruction, AIIntent, AIShapeType } from './types'

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e',
  yellow: '#eab308', orange: '#f97316', purple: '#8b5cf6',
  pink: '#ec4899', white: '#ffffff', black: '#000000',
  gray: '#6b7280', grey: '#6b7280', cyan: '#06b6d4',
}

const COLOR_NAMES = Object.keys(COLOR_MAP).join('|')

/**
 * Why: order matters. Modify must be checked before create because
 * "make" appears in both intents. The key disambiguation:
 * - "make all rectangles blue" → modify (targets existing objects + has color)
 * - "make 3 rectangles" → create (has a count, no color/target modifier)
 *
 * Strategy:
 * 1. Delete checked first (unambiguous keywords)
 * 2. Modify checked before create when:
 *    a. explicit modify keywords (change/set/turn/update/color/fill/opacity), OR
 *    b. "make/turn" + a group target (all/selected) + a color name
 * 3. Create checked after modify
 * 4. Center
 * 5. Unknown fallback
 */
function parseIntent(text: string): AIIntent {
  // ── Delete ──────────────────────────────────────────────────────────
  if (/\b(delete|remove|erase|clear selected)\b/i.test(text)) return 'delete'

  // ── Modify — explicit keywords ───────────────────────────────────────
  // These words unambiguously mean modify, not create
  if (/\b(change|set|update|color|colour|fill|opacity|transparency|alpha)\b/i.test(text)) {
    return 'modify'
  }

  // ── Modify — "make/turn" targeting existing objects with a color ──────
  // e.g. "make all rectangles blue", "turn all circles red"
  // Distinguishes from "make 3 rectangles" (no group target, no color name)
  const hasGroupTarget = /\b(all|selected)\b/i.test(text)
  const hasColorName   = new RegExp(`\\b(${COLOR_NAMES}|#[0-9a-fA-F]{3,6})\\b`, 'i').test(text)

  if (/\b(make|turn)\b/i.test(text) && hasGroupTarget && hasColorName) {
    return 'modify'
  }

  // ── Create ──────────────────────────────────────────────────────────
  if (/\b(create|add|make|draw|insert|place)\b/i.test(text)) return 'create'

  // ── Center ──────────────────────────────────────────────────────────
  if (/\b(center|centre|align|middle)\b/i.test(text)) return 'center'

  return 'unknown'
}

function parseShapeType(text: string): AIShapeType | undefined {
  if (/\b(rect|rectangle|square|box)\b/i.test(text)) return 'rectangle'
  if (/\b(ellipse|circle|oval|round)\b/i.test(text)) return 'ellipse'
  if (/\b(text|label|word|string|heading|title)\b/i.test(text)) return 'text'
  return undefined
}

function parseCount(text: string): number {
  const digitMatch = text.match(/\b(\d+)\b/)
  if (digitMatch?.[1]) return Math.min(parseInt(digitMatch[1], 10), 20)

  const words: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  }
  for (const [word, num] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return num
  }
  return 1
}

function parseColor(text: string): string | undefined {
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return hex
  }
  const hexMatch = text.match(/#([0-9a-fA-F]{3,6})/)
  if (hexMatch?.[0]) return hexMatch[0]
  return undefined
}

function parseTextContent(text: string): string | undefined {
  const quoted = text.match(/["']([^"']+)["']/)
  if (quoted?.[1]) return quoted[1]

  const saying = text.match(/\b(?:saying|with text|labeled?|called?)\s+(.+)/i)
  if (saying?.[1]) return saying[1].trim()

  return undefined
}

function parseTarget(text: string): ParsedInstruction['target'] {
  if (/\bselected\b/i.test(text))                    return 'selected'
  if (/\ball rectangles?\b/i.test(text))             return 'all-rectangles'
  if (/\ball (?:ellipses?|circles?)\b/i.test(text)) return 'all-ellipses'
  if (/\ball text\b/i.test(text))                    return 'all-text'
  if (/\ball\b/i.test(text))                         return 'all'
  return 'selected'
}

function parseProperty(text: string): string | undefined {
  if (/\b(color|colour|fill)\b/i.test(text))           return 'color'
  if (/\b(opacity|transparency|alpha)\b/i.test(text))  return 'opacity'
  return undefined
}

export function parseInstruction(raw: string): ParsedInstruction {
  const text = raw.trim()

  return {
    intent:    parseIntent(text),
    shapeType: parseShapeType(text),
    count:     parseCount(text),
    color:     parseColor(text),
    text:      parseTextContent(text),
    target:    parseTarget(text),
    property:  parseProperty(text),
    raw:       text,
  }
}