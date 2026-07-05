// tests/integration/AIWorkflow.test.ts
import { describe, it, expect } from 'vitest'
import { AIWorkflowService } from '../../src/ai/AIWorkflowService'
import { generateOperations } from '../../src/ai/OperationGenerator'
import { parseInstruction } from '../../src/ai/InstructionParser'

describe('AI Workflow Pipeline — integration', () => {
  let service: AIWorkflowService

  beforeEach(() => {
    service = new AIWorkflowService()
  })

  // ── Empty / invalid input ─────────────────────────────────────────────

  describe('empty and invalid input', () => {
    it('returns failure for empty string', () => {
      const result = service.process('')
      expect(result.success).toBe(false)
      expect(result.message).toContain('enter an instruction')
    })

    it('returns failure for whitespace-only input', () => {
      const result = service.process('   ')
      expect(result.success).toBe(false)
    })

    it('returns failure for unrecognized instruction', () => {
      const result = service.process('xyzzy foobar baz')
      expect(result.success).toBe(false)
      expect(result.operations).toHaveLength(0)
    })

    it('includes the raw instruction in result', () => {
      const result = service.process('create a rectangle')
      expect(result.instruction).toBe('create a rectangle')
    })
  })

  // ── Create pipeline ───────────────────────────────────────────────────

  describe('create instructions → operations', () => {
    it('creates one rectangle by default', () => {
      const result = service.process('create a rectangle')
      expect(result.success).toBe(true)
      expect(result.operations).toHaveLength(1)
      expect(result.operations[0]?.type).toBe('create-shape')
    })

    it('creates multiple shapes from count', () => {
      const result = service.process('create 3 rectangles')
      expect(result.success).toBe(true)
      expect(result.operations).toHaveLength(3)
      expect(result.operations.every(o => o.type === 'create-shape')).toBe(true)
    })

    it('creates ellipse shape type', () => {
      const result = service.process('add a circle')
      expect(result.success).toBe(true)
      const payload = result.operations[0]?.payload as Record<string, unknown>
      expect(payload?.shapeType).toBe('ellipse')
    })

    it('applies color from instruction to create payload', () => {
      const result = service.process('create a blue rectangle')
      expect(result.success).toBe(true)
      const payload = result.operations[0]?.payload as Record<string, unknown>
      expect(payload?.fill).toBe('#3b82f6')
    })

    it('creates text shape with quoted content', () => {
      const result = service.process('add text "Hello World"')
      expect(result.success).toBe(true)
      const payload = result.operations[0]?.payload as Record<string, unknown>
      expect(payload?.shapeType).toBe('text')
      expect(payload?.text).toBe('Hello World')
    })

    it('operations have incrementing x positions for multiple shapes', () => {
      const result = service.process('create 3 rectangles')
      const payloads = result.operations.map(o => o.payload as Record<string, unknown>)
      expect(Number(payloads[0]?.x)).toBeLessThan(Number(payloads[1]?.x))
      expect(Number(payloads[1]?.x)).toBeLessThan(Number(payloads[2]?.x))
    })

    it('word count "two" creates 2 operations', () => {
      const result = service.process('create two ellipses')
      expect(result.operations).toHaveLength(2)
    })

    it('result message mentions operation count', () => {
      const result = service.process('create 3 rectangles')
      expect(result.message).toContain('3')
    })
  })

  // ── Delete pipeline ───────────────────────────────────────────────────

  describe('delete instructions → operations', () => {
    it('generates delete-selected operation', () => {
      const result = service.process('delete selected object')
      expect(result.success).toBe(true)
      expect(result.operations[0]?.type).toBe('delete-selected')
    })

    it('returns failure when target is not selected', () => {
      const result = service.process('delete all objects')
      expect(result.success).toBe(false)
    })

    it('recognizes remove as delete intent', () => {
      const result = service.process('remove selected')
      expect(result.success).toBe(true)
      expect(result.operations[0]?.type).toBe('delete-selected')
    })
  })

  // ── Modify pipeline ───────────────────────────────────────────────────

  describe('modify instructions → operations', () => {
    it('generates modify-color operation for color change', () => {
      const result = service.process('change color to red')
      expect(result.success).toBe(true)
      expect(result.operations[0]?.type).toBe('modify-color')
    })

    it('color payload contains correct hex value', () => {
      const result = service.process('change color to red')
      const payload = result.operations[0]?.payload as Record<string, unknown>
      expect(payload?.color).toBe('#ef4444')
    })

    it('returns failure when modifying without color or opacity', () => {
      const result = service.process('change the thing')
      expect(result.success).toBe(false)
    })

    it('all-rectangles target is preserved in payload', () => {
      const result = service.process('make all rectangles blue')
      expect(result.success).toBe(true)
      const payload = result.operations[0]?.payload as Record<string, unknown>
      expect(payload?.target).toBe('all-rectangles')
    })
  })

  // ── Center pipeline ───────────────────────────────────────────────────

  describe('center instructions → operations', () => {
    it('generates center-objects operation', () => {
      const result = service.process('center all objects')
      expect(result.success).toBe(true)
      expect(result.operations[0]?.type).toBe('center-objects')
    })

    it('centre spelling also works', () => {
      const result = service.process('centre the objects')
      expect(result.success).toBe(true)
    })

    it('center payload includes target', () => {
      const result = service.process('center all objects')
      const payload = result.operations[0]?.payload as Record<string, unknown>
      expect(payload?.target).toBe('all')
    })
  })

  // ── Parser → Generator consistency ───────────────────────────────────

  describe('parser and generator consistency', () => {
    it('parsed intent matches generated operation type', () => {
      const cases = [
        { input: 'create a rectangle',     expectedOp: 'create-shape' },
        { input: 'delete selected',        expectedOp: 'delete-selected' },
        { input: 'change color to green',  expectedOp: 'modify-color' },
        { input: 'center all objects',     expectedOp: 'center-objects' },
      ] as const

      for (const { input, expectedOp } of cases) {
        const result = service.process(input)
        expect(result.success, `Failed for: "${input}"`).toBe(true)
        expect(result.operations[0]?.type, `Wrong op for: "${input}"`).toBe(expectedOp)
      }
    })

    it('parsed result is included in service result', () => {
      const result = service.process('create a blue rectangle')
      expect(result.parsed.intent).toBe('create')
      expect(result.parsed.shapeType).toBe('rectangle')
      expect(result.parsed.color).toBe('#3b82f6')
    })

    it('generateOperations directly matches service result', () => {
      const instruction = 'create 2 green ellipses'
      const parsed = parseInstruction(instruction)
      const { operations } = generateOperations(parsed)
      const serviceResult = service.process(instruction)
      expect(serviceResult.operations).toHaveLength(operations.length)
      expect(serviceResult.operations[0]?.type).toBe(operations[0]?.type)
    })
  })
})