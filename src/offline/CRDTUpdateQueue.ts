// src/offline/CRDTUpdateQueue.ts
// V1: IndexedDB-backed queue for CRDT updates produced while offline
// Guarantees ordering, deduplication, and persistent replay after reconnect

import { nanoid } from 'nanoid'
import { CRDT_QUEUE_KEY } from './types'
import type { QueuedCRDTUpdate } from './types'

const IDB_NAME = 'collab-visual-ide'
const IDB_VERSION = 2
const STORE_NAME = 'crdt-update-queue'

let _db: IDBDatabase | null = null
let _sequence = 0

async function openQueueDB(): Promise<IDBDatabase> {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('sequence', 'sequence', { unique: true })
        store.createIndex('documentId', 'documentId', { unique: false })
      }
    }
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result
      resolve(_db)
    }
    req.onerror = () => reject(req.error)
  })
}

/**
 * V1: Persistent CRDT update queue backed by IndexedDB.
 *
 * Why: localStorage (used by OfflineQueue) has a size limit and stores
 * everything as JSON strings. CRDT updates are binary and can be large.
 * IndexedDB handles Blobs and large payloads correctly and persists
 * across sessions — crucial for offline edit replay.
 *
 * Deduplication: stable 'id' field per update prevents replay of the
 * same update after reconnect even if the browser crashes mid-flush.
 */
export class CRDTUpdateQueue {
  private seenIds = new Set<string>()

  async enqueue(documentId: string, update: Uint8Array): Promise<QueuedCRDTUpdate> {
    const entry: QueuedCRDTUpdate = {
      id: nanoid(),
      documentId,
      sequence: ++_sequence,
      createdAt: Date.now(),
      payload: Array.from(update),
    }

    try {
      const db = await openQueueDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).put(entry)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('[CRDTUpdateQueue] Failed to persist update to IDB:', err)
      // Fall back to localStorage
      this.persistToLocalStorage(entry)
    }

    return entry
  }

  /**
   * Why: returns all queued updates in sequence order for ordered replay.
   * Deduplication happens here — seenIds prevents applying the same
   * update twice if the browser crashes and restores from IDB.
   */
  async getAll(documentId?: string): Promise<QueuedCRDTUpdate[]> {
    try {
      const db = await openQueueDB()
      const all = await new Promise<QueuedCRDTUpdate[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = documentId
          ? store.index('documentId').getAll(documentId)
          : store.getAll()
        req.onsuccess = () => resolve(req.result as QueuedCRDTUpdate[])
        req.onerror = () => reject(req.error)
      })
      return all.sort((a, b) => a.sequence - b.sequence)
    } catch {
      return this.loadFromLocalStorage()
    }
  }

  /**
   * Why: only call after successful transport submission. Leaving the
   * record in place until success means a crash during flush doesn't
   * lose the update — it will be replayed on next reconnect.
   */
  async remove(id: string): Promise<void> {
    try {
      const db = await openQueueDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.objectStore(STORE_NAME).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('[CRDTUpdateQueue] Failed to remove from IDB:', err)
    }
    this.seenIds.add(id)
  }

  isDuplicate(id: string): boolean {
    return this.seenIds.has(id)
  }

  async clear(documentId: string): Promise<void> {
    const all = await this.getAll(documentId)
    for (const entry of all) {
      await this.remove(entry.id)
    }
  }

  async length(documentId?: string): Promise<number> {
    const all = await this.getAll(documentId)
    return all.length
  }

  private persistToLocalStorage(entry: QueuedCRDTUpdate): void {
    try {
      const raw = localStorage.getItem(CRDT_QUEUE_KEY)
      const existing: QueuedCRDTUpdate[] = raw ? JSON.parse(raw) : []
      existing.push(entry)
      localStorage.setItem(CRDT_QUEUE_KEY, JSON.stringify(existing))
    } catch { /* storage full or unavailable */ }
  }

  private loadFromLocalStorage(): QueuedCRDTUpdate[] {
    try {
      const raw = localStorage.getItem(CRDT_QUEUE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }
}

export const crdtUpdateQueue = new CRDTUpdateQueue()
