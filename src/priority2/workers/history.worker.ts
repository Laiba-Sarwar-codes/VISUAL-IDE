import { installWorkerHandler } from './workerRuntime'

installWorkerHandler((request) => {
  if (request.type !== 'compare-snapshots') throw new Error(`Unknown history worker request: ${request.type}`)
  const payload = request.payload as { before: unknown[]; after: unknown[] }
  const before = JSON.stringify(payload.before)
  const after = JSON.stringify(payload.after)
  return {
    changed: before !== after,
    beforeBytes: new TextEncoder().encode(before).byteLength,
    afterBytes: new TextEncoder().encode(after).byteLength,
  }
})
