import { useAssetStore } from '../../../app/stores/asset'
import { useProjectStore } from '../../../app/stores/project'
import { useSceneStore } from '../../../app/stores/scene'
import type {
  Exporter,
  ExportFormat,
  ExportOptions,
  ExportResult,
} from '../../export/types'
import { buildScenePdf } from './PDFBuilder'
import {
  buildSceneSvg,
  downloadBlob,
  getVisibleObjects,
  sanitizeFileName,
} from './SceneExportUtils'
import { createZip, type ZipEntryInput } from './ZipWriter'

/**
 * Existing ExportFormat is intentionally left untouched to preserve every
 * previous file. Runtime adapters safely bridge the two additional formats.
 */
function extendedFormat(value: 'html' | 'zip'): ExportFormat {
  return value as unknown as ExportFormat
}

export const PDFExporterPriority2: Exporter = {
  id: 'priority2-pdf-exporter',
  format: 'pdf',
  label: 'PDF',
  description: 'Portable vector document for printing and sharing.',
  mimeType: 'application/pdf',
  extension: 'pdf',

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    const scene = useSceneStore()
    const project = useProjectStore()
    const objects = getVisibleObjects(scene.objects, options.includeInvisible ?? false)
    if (objects.length === 0) return emptyResult('pdf')

    const bytes = buildScenePdf(objects, project.activeProjectName)
    const pdfBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' })
    const fileName = ensureExtension(
      options.fileName ?? sanitizeFileName(project.activeProjectName),
      'pdf',
    )
    downloadBlob(blob, fileName)
    return successResult('pdf', fileName, blob.size, objects.length)
  },
}

export const HTMLExporterPriority2: Exporter = {
  id: 'priority2-html-exporter',
  format: extendedFormat('html'),
  label: 'HTML',
  description: 'Self-contained HTML preview with inline SVG and scene metadata.',
  mimeType: 'text/html',
  extension: 'html',

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    const scene = useSceneStore()
    const project = useProjectStore()
    const objects = getVisibleObjects(scene.objects, options.includeInvisible ?? false)
    if (objects.length === 0) return emptyResult(extendedFormat('html'))

    const html = buildStandaloneHtml(
      project.activeProjectName,
      objects,
      options.background ?? '#ffffff',
      options.includeMetadata ?? true,
    )
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const fileName = ensureExtension(
      options.fileName ?? sanitizeFileName(project.activeProjectName),
      'html',
    )
    downloadBlob(blob, fileName)
    return successResult(extendedFormat('html'), fileName, blob.size, objects.length)
  },
}

export const ZIPExporterPriority2: Exporter = {
  id: 'priority2-zip-exporter',
  format: extendedFormat('zip'),
  label: 'ZIP',
  description: 'Complete project package with JSON, SVG, HTML and local assets.',
  mimeType: 'application/zip',
  extension: 'zip',

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    const scene = useSceneStore()
    const project = useProjectStore()
    const assets = useAssetStore()
    const objects = getVisibleObjects(scene.objects, options.includeInvisible ?? true)
    if (objects.length === 0) return emptyResult(extendedFormat('zip'))

    const title = project.activeProjectName
    const sceneDocument = {
      schema: 2,
      exportedAt: Date.now(),
      project: { id: project.activeProjectId, name: title },
      objects,
    }
    const svg = buildSceneSvg(objects, {
      background: options.background ?? 'transparent',
      includeMetadata: options.includeMetadata ?? true,
      title,
    })
    const html = buildStandaloneHtml(title, objects, options.background ?? '#ffffff', true)
    const entries: ZipEntryInput[] = [
      { name: 'project.json', data: JSON.stringify(sceneDocument, null, 2) },
      { name: 'scene.svg', data: svg },
      { name: 'index.html', data: html },
      {
        name: 'README.txt',
        data: `Collab Visual IDE export\nProject: ${title}\nObjects: ${objects.length}\nAssets: ${assets.assets.length}\n`,
      },
    ]

    for (const asset of assets.assets) {
      try {
        const response = await fetch(asset.objectUrl)
        if (!response.ok) continue
        const blob = await response.blob()
        entries.push({
          name: `assets/${asset.id}-${safeAssetName(asset.name)}`,
          data: blob,
        })
      } catch {
        // A missing temporary URL should not prevent the project package.
      }
    }

    const blob = await createZip(entries)
    const fileName = ensureExtension(
      options.fileName ?? sanitizeFileName(project.activeProjectName),
      'zip',
    )
    downloadBlob(blob, fileName)
    return successResult(extendedFormat('zip'), fileName, blob.size, objects.length)
  },
}

export function buildStandaloneHtml(
  title: string,
  objects: ReturnType<typeof getVisibleObjects>,
  background: string,
  includeMetadata: boolean,
): string {
  const svg = buildSceneSvg(objects, { background, includeMetadata, title })
  const sceneJson = JSON.stringify({ title, objects }).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    html,body{margin:0;min-height:100%;background:#eef0f4;font-family:Inter,system-ui,sans-serif;color:#111827}
    main{min-height:100vh;display:grid;place-items:center;padding:32px;box-sizing:border-box}
    figure{margin:0;max-width:100%;overflow:auto;background:white;border:1px solid #d1d5db;border-radius:12px;box-shadow:0 20px 60px rgba(15,23,42,.15)}
    svg{display:block;max-width:100%;height:auto}
  </style>
</head>
<body>
  <main><figure aria-label="${escapeHtml(title)}">${svg.replace(/^<\?xml[^>]*>\s*/, '')}</figure></main>
  <script type="application/json" id="collab-scene">${sceneJson}</script>
</body>
</html>`
}

function emptyResult(format: ExportFormat): ExportResult {
  return {
    success: false,
    format,
    fileName: '',
    message: 'Nothing to export — canvas is empty.',
  }
}

function successResult(
  format: ExportFormat,
  fileName: string,
  size: number,
  objectCount: number,
): ExportResult {
  return {
    success: true,
    format,
    fileName,
    size,
    message: `Exported ${objectCount} objects as ${String(format).toUpperCase()}.`,
  }
}

function ensureExtension(fileName: string, extension: string): string {
  const normalized = fileName.trim() || 'export'
  return normalized.toLowerCase().endsWith(`.${extension}`)
    ? normalized
    : `${normalized}.${extension}`
}

function safeAssetName(name: string): string {
  return name.replace(/[^\w.-]+/g, '-') || 'asset.bin'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
