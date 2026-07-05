// src/export/exporters/PNGExporter.ts
// Export System — PNG raster exporter

import { useSceneStore } from '../../../app/stores/scene'
import { useProjectStore } from '../../../app/stores/project'
import { flattenForExport } from '../../layers/LayerExportUtils'
import { resolveCompositeOperation } from '../../layers/types'
import type { SceneObject } from '../../engine/scene-graph/types'
import type { Exporter, ExportOptions, ExportResult } from '../types'

const PADDING = 40

export const PNGExporter: Exporter = {
  id: 'png-exporter',
  format: 'png',
  label: 'PNG',
  description: 'Raster image export for sharing and previews.',
  mimeType: 'image/png',
  extension: 'png',

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    if (typeof document === 'undefined') {
      return {
        success: false,
        format: 'png',
        fileName: '',
        message: 'PNG export is only available in the browser.',
      }
    }

    const scene = useSceneStore()
    const project = useProjectStore()

    const includeInvisible = options.includeInvisible ?? false
    const objects = flattenForExport(scene.objects, includeInvisible)

    if (objects.length === 0) {
      return {
        success: false,
        format: 'png',
        fileName: '',
        message: 'Nothing to export — canvas is empty.',
      }
    }

    const scale = options.scale ?? 1
    const background = options.background ?? 'transparent'
    const bounds = computeBounds(objects)

    const width = Math.ceil(bounds.width + PADDING * 2)
    const height = Math.ceil(bounds.height + PADDING * 2)

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(width * scale))
    canvas.height = Math.max(1, Math.ceil(height * scale))

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return {
        success: false,
        format: 'png',
        fileName: '',
        message: 'Could not create canvas context.',
      }
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    if (background !== 'transparent') {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, width, height)
    }

    const offsetX = -bounds.left + PADDING
    const offsetY = -bounds.top + PADDING

    for (const object of objects) {
      drawObject(ctx, object, offsetX, offsetY)
    }

    const blob = await canvasToBlob(canvas)
    const fileName = options.fileName ?? `${sanitize(project.activeProjectName)}.png`

    downloadBlob(blob, fileName)

    return {
      success: true,
      format: 'png',
      fileName,
      size: blob.size,
      message: `Exported ${objects.length} objects as PNG (${width}×${height})`,
    }
  },
}

function computeBounds(objects: SceneObject[]) {
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const object of objects) {
    left = Math.min(left, object.x)
    top = Math.min(top, object.y)
    right = Math.max(right, object.x + object.width)
    bottom = Math.max(bottom, object.y + object.height)
  }

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  }
}

function drawObject(ctx: CanvasRenderingContext2D, object: SceneObject, offsetX: number, offsetY: number): void {
  const x = object.x + offsetX
  const y = object.y + offsetY

  ctx.save()
  ctx.globalAlpha = object.opacity
  ctx.globalCompositeOperation = resolveCompositeOperation(object.blendMode)
  ctx.translate(x + object.width / 2, y + object.height / 2)
  ctx.rotate((object.rotation * Math.PI) / 180)
  ctx.translate(-object.width / 2, -object.height / 2)

  switch (object.type) {
    case 'rectangle':
      ctx.fillStyle = object.fill
      ctx.strokeStyle = object.stroke
      ctx.fillRect(0, 0, object.width, object.height)
      ctx.strokeRect(0, 0, object.width, object.height)
      break

    case 'ellipse':
      ctx.beginPath()
      ctx.fillStyle = object.fill
      ctx.strokeStyle = object.stroke
      ctx.ellipse(
        object.width / 2,
        object.height / 2,
        object.width / 2,
        object.height / 2,
        0,
        0,
        Math.PI * 2,
      )
      ctx.fill()
      ctx.stroke()
      break

    case 'text':
      ctx.fillStyle = object.fill === 'transparent' ? '#000000' : object.fill
      ctx.font = '16px sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText(object.text ?? 'Text', 0, 0)
      break

    case 'image':
      ctx.fillStyle = '#eeeeee'
      ctx.strokeStyle = '#888888'
      ctx.fillRect(0, 0, object.width, object.height)
      ctx.strokeRect(0, 0, object.width, object.height)
      ctx.fillStyle = '#555555'
      ctx.font = '14px sans-serif'
      ctx.fillText('Image', 10, 10)
      break
  }

  ctx.restore()
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('PNG export failed.'))
      else resolve(blob)
    }, 'image/png')
  })
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