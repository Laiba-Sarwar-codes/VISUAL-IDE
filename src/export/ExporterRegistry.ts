// src/export/ExporterRegistry.ts
// Module 21 — registry of all available exporters

import type { Exporter, ExportFormat, ExportOptions, ExportResult } from './types'

export class ExporterRegistry {
  private exporters = new Map<string, Exporter>()

  register(exporter: Exporter): void {
    this.exporters.set(exporter.id, exporter)
    console.log(`[ExporterRegistry] Registered: ${exporter.label} (${exporter.format})`)
  }

  unregister(id: string): void {
    this.exporters.delete(id)
  }

  getAll(): Exporter[] {
    return Array.from(this.exporters.values())
  }

  getByFormat(format: ExportFormat): Exporter | undefined {
    return this.getAll().find(e => e.format === format)
  }

  get(id: string): Exporter | undefined {
    return this.exporters.get(id)
  }

  /**
   * Why: single entry point for the export UI and command palette.
   * Looks up the exporter for the requested format, calls it, and
   * wraps any thrown errors into a clean ExportResult so the caller
   * never has to try/catch.
   * Inputs: format string; optional export options.
   * Output: ExportResult with success flag, size, and message.
   * Called by: export Pinia store's exportScene action.
   */
  async export(format: ExportFormat, options?: ExportOptions): Promise<ExportResult> {
    const exporter = this.getByFormat(format)

    if (!exporter) {
      return {
        success: false,
        format,
        fileName: '',
        message: `No exporter registered for format: ${format}`,
      }
    }

    try {
      return await exporter.export(options)
    } catch (err) {
      return {
        success: false,
        format,
        fileName: '',
        message: 'Export failed',
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}

export const exporterRegistry = new ExporterRegistry()