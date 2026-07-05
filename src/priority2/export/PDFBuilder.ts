import type { SceneObject } from '../../engine/scene-graph/types'
import { computeSceneBounds } from './SceneExportUtils'

export function buildScenePdf(objects: SceneObject[], title: string): Uint8Array {
  const bounds = computeSceneBounds(objects)
  const maxPage = 14400
  const scale = Math.min(1, maxPage / Math.max(bounds.width, bounds.height))
  const pageWidth = Math.max(100, Math.ceil(bounds.width * scale))
  const pageHeight = Math.max(100, Math.ceil(bounds.height * scale))
  const content = buildContent(objects, bounds.left, bounds.top, pageHeight, scale)
  const safeTitle = pdfString(title)

  const objectsText = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Title (${safeTitle}) /Producer (Collab Visual IDE Priority 2) >>`,
  ]

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const offsets: number[] = [0]
  for (let index = 0; index < objectsText.length; index += 1) {
    offsets.push(byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objectsText[index]}\nendobj\n`
  }

  const xrefOffset = byteLength(pdf)
  pdf += `xref\n0 ${objectsText.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let index = 1; index <= objectsText.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objectsText.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  return new TextEncoder().encode(pdf)
}

function buildContent(
  objects: SceneObject[],
  left: number,
  top: number,
  pageHeight: number,
  scale: number,
): string {
  const commands: string[] = ['q']
  for (const object of objects) {
    const x = (object.x - left) * scale
    const topY = (object.y - top) * scale
    const width = object.width * scale
    const height = object.height * scale
    const y = pageHeight - topY - height
    const [r, g, b] = hexToRgb(object.fill)
    commands.push(`${decimal(r)} ${decimal(g)} ${decimal(b)} rg`)

    if (object.type === 'rectangle' || object.type === 'image') {
      commands.push(`${decimal(x)} ${decimal(y)} ${decimal(width)} ${decimal(height)} re f`)
    } else if (object.type === 'ellipse') {
      commands.push(ellipsePath(x, y, width, height), 'f')
    } else if (object.type === 'text') {
      const fontSize = Math.max(8, Math.min(72, 16 * scale))
      commands.push(
        'BT',
        `/F1 ${decimal(fontSize)} Tf`,
        `${decimal(x)} ${decimal(y + height - fontSize)} Td`,
        `(${pdfString(object.text ?? 'Text')}) Tj`,
        'ET',
      )
    }
  }
  commands.push('Q')
  return commands.join('\n')
}

function ellipsePath(x: number, y: number, width: number, height: number): string {
  const k = 0.552284749831
  const rx = width / 2
  const ry = height / 2
  const cx = x + rx
  const cy = y + ry
  return [
    `${decimal(cx + rx)} ${decimal(cy)} m`,
    `${decimal(cx + rx)} ${decimal(cy + k * ry)} ${decimal(cx + k * rx)} ${decimal(cy + ry)} ${decimal(cx)} ${decimal(cy + ry)} c`,
    `${decimal(cx - k * rx)} ${decimal(cy + ry)} ${decimal(cx - rx)} ${decimal(cy + k * ry)} ${decimal(cx - rx)} ${decimal(cy)} c`,
    `${decimal(cx - rx)} ${decimal(cy - k * ry)} ${decimal(cx - k * rx)} ${decimal(cy - ry)} ${decimal(cx)} ${decimal(cy - ry)} c`,
    `${decimal(cx + k * rx)} ${decimal(cy - ry)} ${decimal(cx + rx)} ${decimal(cy - k * ry)} ${decimal(cx + rx)} ${decimal(cy)} c`,
  ].join('\n')
}

function hexToRgb(value: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : '808080'
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ]
}

function pdfString(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function decimal(value: number): string {
  return Number(value.toFixed(4)).toString()
}
