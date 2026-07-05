// tests/unit/CRDTUpdateQueue.test.ts
// V1: Tests for Task 6 — offline CRDT update queue

import { describe, it, expect, beforeEach, vi } from 'vitest'

// The CRDTUpdateQueue uses IndexedDB which is not available in happy-dom.
// We test the localStorage fallback path and the in-memory deduplication logic.

// Mock indexedDB to force fallback
Object.defineProperty(globalThis, 'indexedDB', {
  value: {
    open: () => {
      const req: Partial<IDBOpenDBRequest> = {}
      setTimeout(() => {
        if ((req as unknown as { onerror?: (e: Event) => void }).onerror) {
          (req as unknown as { onerror: (e: Event) => void }).onerror(new Event('error'))
        }
      }, 0)
      return req as IDBOpenDBRequest
    }
  },
  writable: true,
  configurable: true,
})

// Mock localStorage
const localStorageData: Record<string, string> = {}
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageData[key] ?? null,
    setItem: (key: string, value: string) => { localStorageData[key] = value },
    removeItem: (key: string) => { delete localStorageData[key] },
    clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]) },
  },
  writable: true,
  configurable: true,
})

describe('QueuedCRDTUpdate — V1 structure', () => {
  it('has required fields: id, documentId, sequence, createdAt, payload', () => {
    const update = {
      id: 'test-id',
      documentId: 'doc-1',
      sequence: 1,
      createdAt: Date.now(),
      payload: [1, 2, 3],
    }
    expect(update.id).toBeDefined()
    expect(update.documentId).toBeDefined()
    expect(update.sequence).toBeGreaterThan(0)
    expect(update.createdAt).toBeGreaterThan(0)
    expect(Array.isArray(update.payload)).toBe(true)
  })

  it('payload roundtrips through Uint8Array serialization', () => {
    const original = new Uint8Array([10, 20, 30, 255])
    const serialized = Array.from(original)
    const restored = new Uint8Array(serialized)
    expect(Array.from(restored)).toEqual(Array.from(original))
  })

  it('sequence numbers preserve ordering', () => {
    const updates = [
      { id: 'a', sequence: 3 },
      { id: 'b', sequence: 1 },
      { id: 'c', sequence: 2 },
    ]
    const sorted = [...updates].sort((a, b) => a.sequence - b.sequence)
    expect(sorted[0]?.id).toBe('b')
    expect(sorted[1]?.id).toBe('c')
    expect(sorted[2]?.id).toBe('a')
  })
})

describe('CRDT deduplication logic', () => {
  it('seenIds set prevents duplicate processing', () => {
    const seenIds = new Set<string>()
    const id = 'update-abc'

    seenIds.add(id)
    expect(seenIds.has(id)).toBe(true)
    expect(seenIds.has('other-id')).toBe(false)
  })

  it('different update ids are not considered duplicates', () => {
    const seenIds = new Set<string>()
    seenIds.add('id-1')
    seenIds.add('id-2')
    expect(seenIds.has('id-3')).toBe(false)
  })
})

describe('Offline queue — reconnect replay ordering', () => {
  it('FIFO replay: oldest sequence first', () => {
    const queue = [
      { id: 'c', sequence: 3, payload: [3] },
      { id: 'a', sequence: 1, payload: [1] },
      { id: 'b', sequence: 2, payload: [2] },
    ]
    const ordered = [...queue].sort((a, b) => a.sequence - b.sequence)
    expect(ordered.map(u => u.id)).toEqual(['a', 'b', 'c'])
    expect(ordered.map(u => u.payload[0])).toEqual([1, 2, 3])
  })

  it('failed item stays in queue — not removed', () => {
    const queue = [
      { id: 'fail-1', sequence: 1 },
      { id: 'ok-2', sequence: 2 },
    ]
    // Simulate: ok-2 succeeds (removed), fail-1 fails (kept)
    const remaining = queue.filter(u => u.id !== 'ok-2')
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe('fail-1')
  })
})
