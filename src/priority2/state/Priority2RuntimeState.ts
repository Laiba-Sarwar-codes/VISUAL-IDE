import { ReactiveStateManager } from './ReactiveStateManager'
import type { Priority2DatabaseLike } from '../storage/Priority2Database'

export interface Priority2RuntimeSnapshot {
  projectId: string | null
  historyEntries: number
  historyCursor: number
  manualConnectionState: 'idle' | 'connecting' | 'connected' | 'failed' | 'closed'
  lastBinaryWriteAt: number | null
  lastBinaryChangedBlocks: number
  workersAvailable: boolean
}

interface RuntimeRecord {
  id: string
  state: Priority2RuntimeSnapshot
}

export function createPriority2RuntimeState(database: Priority2DatabaseLike) {
  return new ReactiveStateManager<Priority2RuntimeSnapshot>(
    {
      projectId: null,
      historyEntries: 0,
      historyCursor: 0,
      manualConnectionState: 'idle',
      lastBinaryWriteAt: null,
      lastBinaryChangedBlocks: 0,
      workersAvailable: typeof Worker !== 'undefined',
    },
    {
      historyLimit: 100,
      persistence: {
        async load() {
          const record = await database.get<RuntimeRecord>('runtime', 'priority2-runtime')
          return record?.state ?? null
        },
        async save(state) {
          await database.put<RuntimeRecord>('runtime', {
            id: 'priority2-runtime',
            state: { ...state },
          })
        },
      },
    },
  )
}
