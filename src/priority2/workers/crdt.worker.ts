import * as Y from 'yjs'
import { installWorkerHandler } from './workerRuntime'

installWorkerHandler((request) => {
  if (request.type !== 'merge-updates') throw new Error(`Unknown CRDT worker request: ${request.type}`)
  const payload = request.payload as { updates: number[][] }
  const updates = payload.updates.map((update) => new Uint8Array(update))
  return { update: Array.from(Y.mergeUpdates(updates)) }
})
