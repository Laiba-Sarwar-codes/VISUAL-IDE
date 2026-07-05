import { installWorkerHandler } from './workerRuntime'

installWorkerHandler(async (request) => {
  const payload = request.payload as { bytes: number[]; format?: CompressionFormat }
  const bytes = new Uint8Array(payload.bytes)

  if (request.type === 'compress') {
    if (typeof CompressionStream === 'undefined') return { bytes: Array.from(bytes), compressed: false }
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream(payload.format ?? 'gzip'))
    const output = new Uint8Array(await new Response(stream).arrayBuffer())
    return { bytes: Array.from(output), compressed: true }
  }

  if (request.type === 'decompress') {
    if (typeof DecompressionStream === 'undefined') return { bytes: Array.from(bytes), decompressed: false }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(payload.format ?? 'gzip'))
    const output = new Uint8Array(await new Response(stream).arrayBuffer())
    return { bytes: Array.from(output), decompressed: true }
  }

  throw new Error(`Unknown compression worker request: ${request.type}`)
})
