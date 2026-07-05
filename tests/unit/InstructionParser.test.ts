// tests/unit/InstructionParser.test.ts
import { describe, it, expect } from 'vitest'
import { parseInstruction } from '../../src/ai/InstructionParser'

describe('parseInstruction', () => {

  describe('intent detection', () => {
    it('detects create intent', () => {
      expect(parseInstruction('create a rectangle').intent).toBe('create')
      expect(parseInstruction('add an ellipse').intent).toBe('create')
      expect(parseInstruction('draw 3 circles').intent).toBe('create')
    })

    it('detects delete intent', () => {
      expect(parseInstruction('delete selected object').intent).toBe('delete')
      expect(parseInstruction('remove selected').intent).toBe('delete')
      expect(parseInstruction('erase this').intent).toBe('delete')
    })

    it('detects modify intent', () => {
      expect(parseInstruction('change color to red').intent).toBe('modify')
      expect(parseInstruction('set fill to blue').intent).toBe('modify')
    })

    it('detects center intent', () => {
      expect(parseInstruction('center all objects').intent).toBe('center')
      expect(parseInstruction('align to middle').intent).toBe('center')
    })

    it('returns unknown for unrecognized input', () => {
      expect(parseInstruction('foobar baz').intent).toBe('unknown')
      expect(parseInstruction('').intent).toBe('unknown')
    })
  })

  describe('shape type detection', () => {
    it('detects rectangle', () => {
      expect(parseInstruction('create a rectangle').shapeType).toBe('rectangle')
      expect(parseInstruction('add a square').shapeType).toBe('rectangle')
      expect(parseInstruction('draw a box').shapeType).toBe('rectangle')
    })

    it('detects ellipse', () => {
      expect(parseInstruction('create a circle').shapeType).toBe('ellipse')
      expect(parseInstruction('draw an ellipse').shapeType).toBe('ellipse')
      expect(parseInstruction('add an oval').shapeType).toBe('ellipse')
    })

    it('detects text', () => {
      expect(parseInstruction('add a text label').shapeType).toBe('text')
      expect(parseInstruction('create a heading').shapeType).toBe('text')
    })

    it('returns undefined when no shape mentioned', () => {
      expect(parseInstruction('delete selected').shapeType).toBeUndefined()
    })
  })

  describe('count parsing', () => {
    it('parses digit counts', () => {
      expect(parseInstruction('create 3 rectangles').count).toBe(3)
      expect(parseInstruction('add 10 circles').count).toBe(10)
    })

    it('parses word counts', () => {
      expect(parseInstruction('create two rectangles').count).toBe(2)
      expect(parseInstruction('add five circles').count).toBe(5)
      expect(parseInstruction('draw three boxes').count).toBe(3)
    })

    it('defaults to 1 when no count found', () => {
      expect(parseInstruction('create a rectangle').count).toBe(1)
    })

    it('caps count at 20', () => {
      expect(parseInstruction('create 999 rectangles').count).toBe(20)
    })
  })

  describe('color parsing', () => {
    it('detects named colors', () => {
      expect(parseInstruction('create a red rectangle').color).toBe('#ef4444')
      expect(parseInstruction('add a blue circle').color).toBe('#3b82f6')
      expect(parseInstruction('draw a green ellipse').color).toBe('#22c55e')
    })

    it('detects hex colors', () => {
      expect(parseInstruction('change color to #ff0000').color).toBe('#ff0000')
    })

    it('returns undefined when no color', () => {
      expect(parseInstruction('create a rectangle').color).toBeUndefined()
    })
  })

  describe('text content parsing', () => {
    it('extracts quoted text', () => {
      expect(parseInstruction('add text "Hello World"').text).toBe('Hello World')
      expect(parseInstruction("add text 'Goodbye'").text).toBe('Goodbye')
    })

    it('extracts text after saying keyword', () => {
      expect(parseInstruction('add a label saying Welcome').text).toBe('Welcome')
    })

    it('returns undefined when no text content', () => {
      expect(parseInstruction('create a rectangle').text).toBeUndefined()
    })
  })

  describe('target parsing', () => {
    it('detects selected target', () => {
      expect(parseInstruction('delete selected object').target).toBe('selected')
      expect(parseInstruction('change selected color').target).toBe('selected')
    })

    it('detects all-rectangles target', () => {
      expect(parseInstruction('make all rectangles green').target).toBe('all-rectangles')
    })

    it('detects all target', () => {
      expect(parseInstruction('center all objects').target).toBe('all')
    })

    it('defaults to selected', () => {
      expect(parseInstruction('change color to red').target).toBe('selected')
    })
  })

  describe('raw field', () => {
    it('stores trimmed raw instruction', () => {
      const result = parseInstruction('  create a rectangle  ')
      expect(result.raw).toBe('create a rectangle')
    })
  })
})