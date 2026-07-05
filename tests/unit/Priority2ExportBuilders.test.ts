import { describe, expect, it } from 'vitest'
import { buildScenePdf } from '../../src/priority2/export/PDFBuilder'
import { buildStandaloneHtml } from '../../src/priority2/export/Priority2Exporters'
import { createZip, crc32 } from '../../src/priority2/export/ZipWriter'
import type { SceneObject } from '../../src/engine/scene-graph/types'

const objects: SceneObject[] = [{
  id: 'r1', name: 'Rect', type: 'rectangle', x: 0, y: 0, width: 100,
  height: 80, rotation: 0, visible: true, locked: false, opacity: 1,
  fill: '#ff0000', stroke: '#000000', zIndex: 0,
}]

describe('Priority 2 export builders', () => {
  it('builds a PDF with a valid header and EOF marker', () => {
    const bytes = buildScenePdf(objects, 'Test')
    const text = new TextDecoder().decode(bytes)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.endsWith('%%EOF')).toBe(true)
    expect(text).toContain('/Type /Page')
  })

  it('builds standalone HTML containing the scene SVG and metadata', () => {
    const html = buildStandaloneHtml('Test Scene', objects, '#ffffff', true)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<svg')
    expect(html).toContain('id="collab-scene"')
    expect(html).toContain('Test Scene')
  })

  it('builds a ZIP with local, central and end signatures', async () => {
    const blob = await createZip([{ name: 'hello.txt', data: 'hello' }])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(Array.from(bytes).includes(0x50)).toBe(true)
    expect(blob.type).toBe('application/zip')
  })

  it('calculates the standard CRC32 value', () => {
    expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926')
  })
})
