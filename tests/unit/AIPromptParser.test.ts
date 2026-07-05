// tests/unit/AIPromptParser.test.ts
import { describe, it, expect } from 'vitest'
import { parsePrompt, splitSteps } from '../../src/ai/AIPromptParser'

describe('splitSteps', () => {
  it('keeps a single instruction as one step', () => {
    expect(splitSteps('Create a red rectangle')).toEqual(['Create a red rectangle'])
  })

  it('splits on comma and "and"', () => {
    const steps = splitSteps('Create a rectangle, make it blue and center it')
    expect(steps).toEqual(['Create a rectangle', 'make it blue', 'center it'])
  })

  it('splits three-step instructions', () => {
    const steps = splitSteps('Select all circles, align them at the top and distribute them horizontally')
    expect(steps).toEqual(['Select all circles', 'align them at the top', 'distribute them horizontally'])
  })
})

describe('parsePrompt — object type extraction', () => {
  it('detects rectangle from "rectangle"/"square"/"box"', () => {
    expect(parsePrompt('Create a rectangle')[0]?.objectType).toBe('rectangle')
    expect(parsePrompt('Create a square')[0]?.objectType).toBe('rectangle')
  })

  it('detects ellipse from "circle"/"ellipse"/"oval"', () => {
    expect(parsePrompt('Add three circles')[0]?.objectType).toBe('ellipse')
    expect(parsePrompt('Create an oval')[0]?.objectType).toBe('ellipse')
  })

  it('detects text from "text"/"heading"/"label"', () => {
    expect(parsePrompt('Create a heading')[0]?.objectType).toBe('text')
  })
})

describe('parsePrompt — color extraction', () => {
  it('extracts a named color', () => {
    expect(parsePrompt('Create a red rectangle')[0]?.color).toBe('#ef4444')
  })

  it('extracts color for a set-color instruction', () => {
    expect(parsePrompt('Make all selected objects blue')[0]?.color).toBe('#3b82f6')
  })

  it('extracts a hex color', () => {
    expect(parsePrompt('Change color to #abcdef')[0]?.color).toBe('#abcdef')
  })
})

describe('parsePrompt — numeric extraction', () => {
  it('extracts a digit count', () => {
    expect(parsePrompt('Create 3 blue rectangles')[0]?.count).toBe(3)
  })

  it('extracts a word count', () => {
    expect(parsePrompt('Add three circles')[0]?.count).toBe(3)
  })

  it('extracts a percentage opacity', () => {
    expect(parsePrompt('Set opacity to 50%')[0]?.opacityValue).toBeCloseTo(0.5)
  })
})

describe('parsePrompt — intents', () => {
  it('recognizes create', () => {
    expect(parsePrompt('Create a red rectangle')[0]?.intent).toBe('create')
  })

  it('recognizes delete', () => {
    expect(parsePrompt('Delete the second circle')[0]?.intent).toBe('delete')
  })

  it('recognizes duplicate', () => {
    expect(parsePrompt('Duplicate the selected objects')[0]?.intent).toBe('duplicate')
  })

  it('recognizes align with edge', () => {
    const step = parsePrompt('Align selected objects to the left')[0]
    expect(step?.intent).toBe('align')
    expect(step?.edge).toBe('left')
  })

  it('recognizes distribute with axis', () => {
    const step = parsePrompt('Distribute selected objects horizontally')[0]
    expect(step?.intent).toBe('distribute')
    expect(step?.axis).toBe('horizontal')
  })

  it('recognizes group', () => {
    expect(parsePrompt('Group the selected objects')[0]?.intent).toBe('group')
  })

  it('recognizes set-visibility (hide)', () => {
    const step = parsePrompt('Hide all text elements')[0]
    expect(step?.intent).toBe('set-visibility')
    expect(step?.visibilityValue).toBe(false)
  })

  it('recognizes set-lock', () => {
    const step = parsePrompt('Lock the background object')[0]
    expect(step?.intent).toBe('set-lock')
    expect(step?.lockValue).toBe(true)
  })

  it('recognizes reorder (front)', () => {
    const step = parsePrompt('Bring the logo to the front')[0]
    expect(step?.intent).toBe('reorder')
    expect(step?.direction).toBe('front')
  })

  it('recognizes rename with a new name', () => {
    const step = parsePrompt('Rename the selected layer to Header')[0]
    expect(step?.intent).toBe('rename')
    expect(step?.newName).toBe('Header')
  })

  it('recognizes select', () => {
    expect(parsePrompt('Select all circles')[0]?.intent).toBe('select')
  })

  it('recognizes a relative move with an anchor', () => {
    const step = parsePrompt('Move the object named Header below the logo')[0]
    expect(step?.intent).toBe('move')
    expect(step?.moveMode).toBe('relative-anchor')
    expect(step?.anchorDirection).toBe('below')
    expect(step?.anchorPhrase).toContain('logo')
  })

  it('recognizes center as a move', () => {
    const step = parsePrompt('Move the selected object to the center')[0]
    expect(step?.intent).toBe('move')
    expect(step?.moveMode).toBe('center')
  })

  it('falls back to unknown for unrecognized text', () => {
    expect(parsePrompt('asdkjfh qwoeiru')[0]?.intent).toBe('unknown')
  })
})
