// src/export/types.ts
// Module 21 — export system type definitions

export type ExportFormat = 'json' | 'svg' | 'png' | 'pdf'

export interface ExportOptions {
  fileName?: string
  scale?: number              // raster only (PNG)
  background?: string         // hex or 'transparent'
  quality?: number            // 0..1
  includeInvisible?: boolean
  includeMetadata?: boolean
}

export interface ExportResult {
  success: boolean
  format: ExportFormat
  fileName: string
  size?: number               // bytes
  message: string
  error?: string
}

/**
 * Why: every format implements this interface. Adding a new format
 * (PDF, etc.) means creating one class implementing Exporter and
 * registering it — no changes to registry, store, or UI needed.
 */
export interface Exporter {
  id: string
  format: ExportFormat
  label: string
  description: string
  mimeType: string
  extension: string
  export(options?: ExportOptions): Promise<ExportResult>
}

export interface ExportStoreState {
  isDialogOpen: boolean
  isExporting: boolean
  selectedFormat: ExportFormat
  lastResult: ExportResult | null
  history: ExportResult[]
}