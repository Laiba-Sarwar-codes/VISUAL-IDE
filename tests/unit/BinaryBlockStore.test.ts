import { describe, expect, it } from 'vitest'
import { BinaryBlockStore } from '../../src/priority2/storage/BinaryBlockStore'
import { MemoryPriority2Database } from '../../src/priority2/storage/Priority2Database'

function testHash(bytes: Uint8Array): Promise<string> {
  return Promise.resolve(Array.from(bytes).join('-'))
}

describe('BinaryBlockStore', () => {
  it('round-trips a document split into blocks', async () => {
    const database = new MemoryPriority2Database()
    const store = new BinaryBlockStore(database, { chunkSize: 1024, hash: testHash })
    const input = Uint8Array.from({ length: 2500 }, (_, index) => index % 251)
    const result = await store.putDocument('doc', input)
    const restored = await store.getDocument('doc')
    expect(result.totalBlocks).toBe(3)
    expect(result.changedBlocks).toBe(3)
    expect(Array.from(restored ?? [])).toEqual(Array.from(input))
  })

  it('writes only new blocks on a later version', async () => {
    const database = new MemoryPriority2Database()
    const store = new BinaryBlockStore(database, { chunkSize: 1024, hash: testHash })
    const first = new Uint8Array(2500).fill(1)
    await store.putDocument('doc', first)
    const second = first.slice()
    second[1300] = 2
    const result = await store.putDocument('doc', second)
    expect(result.totalBlocks).toBe(3)
    expect(result.changedBlocks).toBe(1)
    expect(result.reusedBlocks).toBe(2)
  })

  it('deduplicates identical blocks across documents', async () => {
    const database = new MemoryPriority2Database()
    const store = new BinaryBlockStore(database, { chunkSize: 1024, hash: testHash })
    const bytes = new Uint8Array(1500).fill(7)
    await store.putDocument('a', bytes)
    const second = await store.putDocument('b', bytes)
    expect(second.changedBlocks).toBe(0)
    expect(second.reusedBlocks).toBe(2)
  })

  it('garbage-collects unreferenced blocks', async () => {
    const database = new MemoryPriority2Database()
    const store = new BinaryBlockStore(database, { chunkSize: 1024, hash: testHash })
    await store.putDocument('doc', new Uint8Array(1500).fill(3))
    await store.deleteDocument('doc')
    expect(await store.collectGarbage()).toBe(2)
  })
})
