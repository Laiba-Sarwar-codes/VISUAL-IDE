// app/stores/export.ts
// Export System — Pinia store for export dialog/actions

import { defineStore } from 'pinia'
import { exporterRegistry } from '~~/src/export/ExporterRegistry'
import { JSONExporter } from '~~/src/export/exporters/JSONExporter'
import { SVGExporter } from '~~/src/export/exporters/SVGExporter'
import { PNGExporter } from '~~/src/export/exporters/PNGExporter'
import type { ExportFormat, ExportOptions, ExportResult, ExportStoreState } from '~~/src/export/types'

let exportersRegistered = false

function registerDefaultExporters(): void {
  if (exportersRegistered) return

  exporterRegistry.register(JSONExporter)
  exporterRegistry.register(SVGExporter)
  exporterRegistry.register(PNGExporter)

  exportersRegistered = true
}

export const useExportStore = defineStore('export', {
  state: (): ExportStoreState => ({
    isDialogOpen: false,
    isExporting: false,
    selectedFormat: 'png',
    lastResult: null,
    history: [],
  }),

  getters: {
    availableExporters() {
      registerDefaultExporters()
      return exporterRegistry.getAll()
    },
  },

  actions: {
    openDialog(): void {
      registerDefaultExporters()
      this.isDialogOpen = true
    },

    closeDialog(): void {
      this.isDialogOpen = false
    },

    setFormat(format: ExportFormat): void {
      this.selectedFormat = format
    },

    async exportScene(options: ExportOptions = {}): Promise<ExportResult> {
      registerDefaultExporters()
      this.isExporting = true

      try {
        const result = await exporterRegistry.export(this.selectedFormat, options)
        this.lastResult = result
        this.history.unshift(result)
        this.history = this.history.slice(0, 20)
        return result
      } finally {
        this.isExporting = false
      }
    },

    clearHistory(): void {
      this.history = []
      this.lastResult = null
    },
  },
})