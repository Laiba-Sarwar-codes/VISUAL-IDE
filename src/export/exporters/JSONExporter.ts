// src/export/exporters/JSONExporter.ts
// Module 21 — JSON scene exporter

import { useSceneStore } from '../../../app/stores/scene'
import { useProjectStore } from '../../../app/stores/project'
import type { Exporter, ExportOptions, ExportResult } from '../types'

const SCHEMA_VERSION = 1

export const JSONExporter: Exporter = {
  id: 'json-exporter',
  format: 'json',
  label: 'JSON',
  description: 'Full scene data as JSON — re-importable into this editor.',
  mimeType: 'application/json',
  extension: 'json',

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    const scene = useSceneStore()
    const project = useProjectStore()

    const includeInvisible = options.includeInvisible ?? true
    const objects = includeInvisible
      ? scene.objects
      : scene.objects.filter(o => o.visible)

    const doc = {
      schema: SCHEMA_VERSION,
      exportedAt: Date.now(),
      project: {
        id: project.activeProjectId,
        name: project.activeProjectName,
      },
      objects,
    }

    const json = JSON.stringify(doc, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const fileName = options.fileName ?? `${sanitize(project.activeProjectName)}.json`

    downloadBlob(blob, fileName)

    return {
      success: true,
      format: 'json',
      fileName,
      size: blob.size,
      message: `Exported ${objects.length} objects (${formatSize(blob.size)})`,
    }
  },
}

function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, '-').toLowerCase() || 'export'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}