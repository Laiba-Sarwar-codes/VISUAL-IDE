// tests/integration/ExporterRegistry.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExporterRegistry } from '../../src/export/ExporterRegistry'
import type { Exporter, ExportFormat, ExportResult } from '../../src/export/types'

function makeExporter(format: ExportFormat, succeed = true): Exporter {
  return {
    id:          `${format}-exporter`,
    format,
    label:       format.toUpperCase(),
    description: `Test ${format} exporter`,
    mimeType:    'application/octet-stream',
    extension:   format,
    export: vi.fn(async (): Promise<ExportResult> => {
      if (!succeed) throw new Error('Export failed intentionally')
      return {
        success:  true,
        format,
        fileName: `test.${format}`,
        size:     1024,
        message:  `Exported as ${format}`,
      }
    }),
  }
}

describe('ExporterRegistry — integration', () => {
  let registry: ExporterRegistry

  beforeEach(() => {
    registry = new ExporterRegistry()
  })

  describe('register and retrieve', () => {
    it('registers an exporter and retrieves by id', () => {
      const exp = makeExporter('json')
      registry.register(exp)
      expect(registry.get('json-exporter')).toBeDefined()
    })

    it('getAll returns all registered exporters', () => {
      registry.register(makeExporter('json'))
      registry.register(makeExporter('svg'))
      registry.register(makeExporter('png'))
      expect(registry.getAll()).toHaveLength(3)
    })

    it('getByFormat finds the correct exporter', () => {
      registry.register(makeExporter('svg'))
      const found = registry.getByFormat('svg')
      expect(found?.format).toBe('svg')
    })

    it('getByFormat returns undefined for unregistered format', () => {
      expect(registry.getByFormat('pdf')).toBeUndefined()
    })

    it('unregister removes the exporter', () => {
      registry.register(makeExporter('json'))
      registry.unregister('json-exporter')
      expect(registry.get('json-exporter')).toBeUndefined()
    })
  })

  describe('export method', () => {
    it('calls the correct exporter for the format', async () => {
      const exp = makeExporter('json')
      registry.register(exp)
      const result = await registry.export('json')
      expect(exp.export).toHaveBeenCalledOnce()
      expect(result.success).toBe(true)
    })

    it('returns error result when no exporter registered', async () => {
      const result = await registry.export('pdf')
      expect(result.success).toBe(false)
      expect(result.message).toContain('pdf')
    })

    it('returns error result when exporter throws', async () => {
      registry.register(makeExporter('png', false))
      const result = await registry.export('png')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('passes options to the exporter', async () => {
      const exp = makeExporter('svg')
      registry.register(exp)
      await registry.export('svg', { fileName: 'custom.svg', scale: 2 })
      expect(exp.export).toHaveBeenCalledWith({ fileName: 'custom.svg', scale: 2 })
    })

    it('result includes correct format', async () => {
      registry.register(makeExporter('json'))
      const result = await registry.export('json')
      expect(result.format).toBe('json')
    })
  })
})