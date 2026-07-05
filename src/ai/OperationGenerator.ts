// src/ai/OperationGenerator.ts
// Module 19 — converts parsed instructions into structured operations
// Fixed: generateModify handles color even without explicit 'color' keyword

import type { ParsedInstruction, AIOperation } from './types'

export function generateOperations(
  parsed: ParsedInstruction
): { operations: AIOperation[]; error?: string } {
  switch (parsed.intent) {
    case 'create':
      return generateCreate(parsed)
    case 'delete':
      return generateDelete(parsed)
    case 'modify':
      return generateModify(parsed)
    case 'center':
      return generateCenter(parsed)
    case 'unknown':
      return {
        operations: [],
        error: `I didn't understand: "${parsed.raw}". Try "Create 3 blue rectangles" or "Delete selected object".`,
      }
  }
}

function generateCreate(parsed: ParsedInstruction): { operations: AIOperation[] } {
  const count = parsed.count ?? 1
  const shape = parsed.shapeType ?? 'rectangle'
  const operations: AIOperation[] = []

  for (let i = 0; i < count; i++) {
    operations.push({
      type: 'create-shape',
      description: `Create ${shape}${count > 1 ? ` (${i + 1}/${count})` : ''}`,
      payload: {
        shapeType: shape,
        x: 100 + i * 140,
        y: 200,
        fill: parsed.color ?? defaultFill(shape),
        text: shape === 'text' ? (parsed.text ?? 'Text') : undefined,
      },
    })
  }

  return { operations }
}

function generateDelete(
  parsed: ParsedInstruction
): { operations: AIOperation[]; error?: string } {
  if (parsed.target !== 'selected') {
    return {
      operations: [],
      error: 'I can only delete the selected object. Click a shape first, then try again.',
    }
  }
  return {
    operations: [{
      type: 'delete-selected',
      description: 'Delete selected object',
      payload: {},
    }],
  }
}

/**
 * Why: previously required parsed.property === 'color' but instructions
 * like "make all rectangles blue" parse a color value without an explicit
 * "color" keyword — property is undefined. Fix: treat any parsed color as
 * a color modification when no other property is specified. This preserves
 * the target field (e.g. "all-rectangles") correctly in the payload.
 */
function generateModify(
  parsed: ParsedInstruction
): { operations: AIOperation[]; error?: string } {
  // Color: explicit property OR color value detected without a property keyword
  const isColorIntent =
    parsed.property === 'color' ||
    (parsed.color !== undefined && parsed.property === undefined)

  if (isColorIntent && parsed.color) {
    return {
      operations: [{
        type: 'modify-color',
        description: `Set fill color to ${parsed.color}`,
        payload: {
          color: parsed.color,
          target: parsed.target ?? 'selected',
        },
      }],
    }
  }

  if (parsed.property === 'opacity') {
    const val = typeof parsed.value === 'number' ? parsed.value : 0.5
    return {
      operations: [{
        type: 'modify-opacity',
        description: `Set opacity to ${val}`,
        payload: {
          opacity: val,
          target: parsed.target ?? 'selected',
        },
      }],
    }
  }

  return {
    operations: [],
    error: 'I can modify color or opacity. Try "Change color to red" or "Set opacity to 0.5".',
  }
}

function generateCenter(parsed: ParsedInstruction): { operations: AIOperation[] } {
  return {
    operations: [{
      type: 'center-objects',
      description: 'Center all objects on canvas',
      payload: { target: parsed.target ?? 'all' },
    }],
  }
}

function defaultFill(shape: string): string {
  if (shape === 'rectangle') return '#3b82f6'
  if (shape === 'ellipse') return '#22c55e'
  return 'transparent'
}