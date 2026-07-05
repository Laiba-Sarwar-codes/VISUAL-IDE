import { flattenForExport } from '../../layers/LayerExportUtils'
import type { SceneObject } from '../../engine/scene-graph/types'

export interface SceneBounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

/**
 * Why: delegates to LayerExportUtils.flattenForExport so PDF/HTML/ZIP
 * exports (Priority2Exporters.ts, the only callers) get the same
 * hierarchy-aware leaf-only, effective-opacity/blend-mode/paint-order
 * resolution as the native PNG/SVG exporters, without duplicating that
 * logic a third time.
 */
export function getVisibleObjects(objects: SceneObject[], includeInvisible = false): SceneObject[] {
  return flattenForExport(objects, includeInvisible)
}

export function computeSceneBounds(objects: SceneObject[], padding = 40): SceneBounds {
  if (objects.length === 0) {
    return { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 }
  }

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
    left: left - padding,
    top: top - padding,
    right: right + padding,
    bottom: bottom + padding,
    width: Math.max(1, right - left + padding * 2),
    height: Math.max(1, bottom - top + padding * 2),
  }
}

export function buildSceneSvg(
  objects: SceneObject[],
  options: { background?: string; includeMetadata?: boolean; title?: string } = {},
): string {
  const bounds = computeSceneBounds(objects)
  const offsetX = -bounds.left
  const offsetY = -bounds.top
  const background = options.background ?? 'transparent'
  const elements = objects.map((object) => objectToSvg(object, offsetX, offsetY)).join('\n    ')
  const metadata = options.includeMetadata
    ? `<metadata>${escapeXml(JSON.stringify({ title: options.title ?? 'Scene', exportedAt: Date.now(), objectCount: objects.length }))}</metadata>`
    : ''
  const backgroundElement = background === 'transparent'
    ? ''
    : `<rect width="100%" height="100%" fill="${escapeXml(background)}" />`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width)}" height="${Math.ceil(bounds.height)}" viewBox="0 0 ${Math.ceil(bounds.width)} ${Math.ceil(bounds.height)}">
  ${metadata}
  ${backgroundElement}
  <g>
    ${elements}
  </g>
</svg>`
}

function objectToSvg(object: SceneObject, offsetX: number, offsetY: number): string {
  const x = object.x + offsetX
  const y = object.y + offsetY
  const centerX = x + object.width / 2
  const centerY = y + object.height / 2
  const transform = object.rotation
    ? ` transform="rotate(${number(object.rotation)} ${number(centerX)} ${number(centerY)})"`
    : ''
  const opacity = object.opacity < 1 ? ` opacity="${number(object.opacity)}"` : ''
  const stroke = object.stroke && object.stroke !== 'transparent'
    ? ` stroke="${escapeXml(object.stroke)}"`
    : ''
  const blend = object.blendMode && object.blendMode !== 'normal'
    ? ` style="mix-blend-mode: ${object.blendMode}"`
    : ''

  switch (object.type) {
    case 'rectangle':
      return `<rect x="${number(x)}" y="${number(y)}" width="${number(object.width)}" height="${number(object.height)}" fill="${escapeXml(object.fill)}"${stroke}${opacity}${transform}${blend} />`
    case 'ellipse':
      return `<ellipse cx="${number(centerX)}" cy="${number(centerY)}" rx="${number(object.width / 2)}" ry="${number(object.height / 2)}" fill="${escapeXml(object.fill)}"${stroke}${opacity}${transform}${blend} />`
    case 'text':
      return `<text x="${number(x)}" y="${number(y + 18)}" font-family="Inter, Arial, sans-serif" font-size="16" fill="${escapeXml(object.fill === 'transparent' ? '#111827' : object.fill)}"${opacity}${transform}${blend}>${escapeXml(object.text ?? 'Text')}</text>`
    case 'image':
      return `<g${opacity}${transform}${blend}><rect x="${number(x)}" y="${number(y)}" width="${number(object.width)}" height="${number(object.height)}" fill="#e5e7eb" stroke="#9ca3af" /><text x="${number(x + 10)}" y="${number(y + 22)}" font-family="Arial, sans-serif" font-size="13" fill="#4b5563">Image ${escapeXml(object.assetId ?? '')}</text></g>`
    default:
      // 'group'/'folder' never reach here — flattenForExport (this function's
      // only caller path) already resolves the tree down to leaf objects.
      return ''
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export'
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function number(value: number): string {
  return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '0'
}
