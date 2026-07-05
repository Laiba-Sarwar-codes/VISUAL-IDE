// src/offline/types.ts
// V1: Added QueuedCRDTUpdate for IndexedDB-persisted CRDT queue

export type NetworkStatus = 'online' | 'offline' | 'reconnecting'

export type OfflineOperationType =
  | 'scene:add'
  | 'scene:remove'
  | 'scene:update'
  | 'scene:reorder'
  | 'crdt:update'

export interface OfflineOperation {
  id: string
  type: OfflineOperationType
  timestamp: number
  projectId: string
  payload: Record<string, unknown>
  retryCount: number
  maxRetries: number
}

/**
 * V1: Stable structure for CRDT updates that need IndexedDB persistence.
 * Sequence number preserves ordering across sessions.
 */
export interface QueuedCRDTUpdate {
  id: string
  documentId: string
  sequence: number
  createdAt: number
  payload: number[]  // Uint8Array serialized as number[] for IDB storage
}

export interface OfflineQueueState {
  operations: OfflineOperation[]
  lastFlushedAt: number | null
  flushInProgress: boolean
}

export const OFFLINE_QUEUE_KEY = 'collab-ide-offline-queue'
export const CRDT_QUEUE_KEY = 'collab-ide-crdt-queue'
export const MAX_QUEUE_SIZE = 500
export const MAX_RETRIES = 3
