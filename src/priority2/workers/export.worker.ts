import { installWorkerHandler } from './workerRuntime'

installWorkerHandler((request) => {
  if (request.type !== 'serialize-scene') throw new Error(`Unknown export worker request: ${request.type}`)
  const payload = request.payload as { title: string; objects: unknown[]; exportedAt?: number }
  const json = JSON.stringify({
    schema: 2,
    title: payload.title,
    exportedAt: payload.exportedAt ?? Date.now(),
    objects: payload.objects,
  }, null, 2)
  return { json, bytes: new TextEncoder().encode(json).byteLength }
})
