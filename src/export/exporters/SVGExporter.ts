// src/export/exporters/SVGExporter.ts
// Module 21 — SVG vector exporter

import { useSceneStore } from '../../../app/stores/scene'
import { useProjectStore } from '../../../app/stores/project'
import { flattenForExport } from '../../layers/LayerExportUtils'
import type { Exporter, ExportOptions, ExportResult } from '../types'
import type { SceneObject } from '../../engine/scene-graph/types'

const PADDING = 40

export const SVGExporter: Exporter = {
  id: 'svg-exporter',
  format: 'svg',
  label: 'SVG',
  description: 'Vector image — infinitely scalable, editable in Illustrator/Figma.',
  mimeType: 'image/svg+xml',
  extension: 'svg',

  /**
   * Why: computes bounds of all visible objects, generates an SVG
   * document sized to fit with padding, then emits each object as
   * the correct SVG element. Text objects use <text>, rectangles
   * use <rect>, ellipses use <ellipse>.
   */
  async export(options: ExportOptions = {}): Promise<ExportResult> {
    const scene = useSceneStore()
    const project = useProjectStore()

    const includeInvisible = options.includeInvisible ?? false
    const background = options.background ?? 'transparent'
    const objects = flattenForExport(scene.objects, includeInvisible)

    if (objects.length === 0) {
      return {
        success: false,
        format: 'svg',
        fileName: '',
        message: 'Nothing to export — canvas is empty.',
      }
    }

    const bounds = computeBounds(objects)
    const width = Math.ceil(bounds.width + PADDING * 2)
    const height = Math.ceil(bounds.height + PADDING * 2)
    const offsetX = -bounds.left + PADDING
    const offsetY = -bounds.top + PADDING

    const elements = objects.map(o => objectToSVG(o, offsetX, offsetY)).join('\n  ')

    const bgLayer = background !== 'transparent'
      ? `<rect width="${width}" height="${height}" fill="${escapeXml(background)}" />`
      : ''

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${bgLayer}
  ${elements}
</svg>`

    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const fileName = options.fileName ?? `${sanitize(project.activeProjectName)}.svg`
    downloadBlob(blob, fileName)

    return {
      success: true,
      format: 'svg',
      fileName,
      size: blob.size,
      message: `Exported ${objects.length} objects as SVG (${width}×${height})`,
    }
  },
}

function computeBounds(objects: SceneObject[]) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const o of objects) {
    left   = Math.min(left, o.x)
    top    = Math.min(top, o.y)
    right  = Math.max(right, o.x + o.width)
    bottom = Math.max(bottom, o.y + o.height)
  }
  return { left, top, width: right - left, height: bottom - top }
}

/**
 * Why: converts one scene object to its SVG element string. Handles
 * rotation via SVG transform attribute, opacity via fill-opacity, and
 * (Layer Management) blend mode via the CSS `mix-blend-mode` property —
 * SVG's supported blend-mode keywords are the same set this project uses,
 * except 'normal' which needs no style attribute at all.
 * Image type produces an <image> element referencing the asset URL —
 * self-contained SVG works only if the URL is a data URL.
 */
function objectToSVG(obj: SceneObject, offsetX: number, offsetY: number): string {
  const x = obj.x + offsetX
  const y = obj.y + offsetY
  const transform = obj.rotation !== 0
    ? ` transform="rotate(${obj.rotation} ${x + obj.width / 2} ${y + obj.height / 2})"`
    : ''
  const opacity = obj.opacity !== 1 ? ` opacity="${obj.opacity}"` : ''
  const blend = obj.blendMode && obj.blendMode !== 'normal'
    ? ` style="mix-blend-mode: ${obj.blendMode}"`
    : ''

  switch (obj.type) {
    case 'rectangle':
      return `<rect x="${x}" y="${y}" width="${obj.width}" height="${obj.height}" fill="${escapeXml(obj.fill)}"${opacity}${transform}${blend} />`
    case 'ellipse':
      return `<ellipse cx="${x + obj.width / 2}" cy="${y + obj.height / 2}" rx="${obj.width / 2}" ry="${obj.height / 2}" fill="${escapeXml(obj.fill)}"${opacity}${transform}${blend} />`
    case 'text': {
      const color = obj.fill === 'transparent' ? '#000000' : obj.fill
      const escaped = escapeXml(obj.text ?? 'Text')
      return `<text x="${x}" y="${y + 14}" font-family="sans-serif" font-size="14" fill="${escapeXml(color)}"${opacity}${transform}${blend}>${escaped}</text>`
    }
    case 'image':
      return `<rect x="${x}" y="${y}" width="${obj.width}" height="${obj.height}" fill="#eee" stroke="#888"${opacity}${transform}${blend} /><!-- image placeholder -->`
    default:
      return ''
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function sanitize(name: string): string {
  return name.replace(/[^\w.-]+/g, '-').toLowerCase() || 'export'
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}