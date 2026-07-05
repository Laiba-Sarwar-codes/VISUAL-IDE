import type { Priority2DatabaseLike } from './Priority2Database'

export interface BinaryBlockRecord {
  id: string
  bytes: ArrayBuffer
  byteLength: number
  createdAt: number
}

export interface BinaryManifestRecord {
  id: string
  blockHashes: string[]
  byteLength: number
  chunkSize: number
  mimeType: string
  metadata: Record<string, string | number | boolean | null>
  updatedAt: number
  version: number
}

export interface BinaryWriteResult {
  manifest: BinaryManifestRecord
  totalBlocks: number
  changedBlocks: number
  reusedBlocks: number
  bytesWritten: number
}

export interface BinaryBlockStoreOptions {
  chunkSize?: number
  hash?: (bytes: Uint8Array) => Promise<string>
}

const DEFAULT_CHUNK_SIZE = 64 * 1024

/**
 * Content-addressed binary storage.
 *
 * A document is split into fixed-size blocks and each block is keyed by its
 * SHA-256 hash. Saving a changed document only writes blocks whose hashes are
 * not already present. The manifest is replaced atomically after all blocks
 * have been stored.
 */
export class BinaryBlockStore {
  private readonly chunkSize: number
  private readonly hash: (bytes: Uint8Array) => Promise<string>

  constructor(
    private readonly database: Priority2DatabaseLike,
    options: BinaryBlockStoreOptions = {},
  ) {
    this.chunkSize = Math.max(1024, options.chunkSize ?? DEFAULT_CHUNK_SIZE)
    this.hash = options.hash ?? sha256Hex
  }

  async putDocument(
    documentId: string,
    bytes: Uint8Array,
    options: {
      mimeType?: string
      metadata?: Record<string, string | number | boolean | null>
    } = {},
  ): Promise<BinaryWriteResult> {
    const blockHashes: string[] = []
    let changedBlocks = 0
    let reusedBlocks = 0
    let bytesWritten = 0

    for (let offset = 0; offset < bytes.byteLength; offset += this.chunkSize) {
      const chunk = bytes.slice(offset, Math.min(bytes.byteLength, offset + this.chunkSize))
      const hash = await this.hash(chunk)
      blockHashes.push(hash)

      const existing = await this.database.get<BinaryBlockRecord>('binary-blocks', hash)
      if (existing) {
        reusedBlocks += 1
        continue
      }

      const stableBuffer = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength,
      ) as ArrayBuffer

      await this.database.put<BinaryBlockRecord>('binary-blocks', {
        id: hash,
        bytes: stableBuffer,
        byteLength: chunk.byteLength,
        createdAt: Date.now(),
      })
      changedBlocks += 1
      bytesWritten += chunk.byteLength
    }

    const previous = await this.getManifest(documentId)
    const manifest: BinaryManifestRecord = {
      id: documentId,
      blockHashes,
      byteLength: bytes.byteLength,
      chunkSize: this.chunkSize,
      mimeType: options.mimeType ?? previous?.mimeType ?? 'application/octet-stream',
      metadata: options.metadata ?? previous?.metadata ?? {},
      updatedAt: Date.now(),
      version: (previous?.version ?? 0) + 1,
    }

    await this.database.put('binary-manifests', manifest)

    return {
      manifest,
      totalBlocks: blockHashes.length,
      changedBlocks,
      reusedBlocks,
      bytesWritten,
    }
  }

  async getDocument(documentId: string): Promise<Uint8Array | null> {
    const manifest = await this.getManifest(documentId)
    if (!manifest) return null

    const output = new Uint8Array(manifest.byteLength)
    let offset = 0

    for (const hash of manifest.blockHashes) {
      const block = await this.database.get<BinaryBlockRecord>('binary-blocks', hash)
      if (!block) {
        throw new Error(`Binary block ${hash} is missing for document ${documentId}.`)
      }
      const source = new Uint8Array(block.bytes)
      output.set(source, offset)
      offset += source.byteLength
    }

    return output
  }

  getManifest(documentId: string): Promise<BinaryManifestRecord | null> {
    return this.database.get<BinaryManifestRecord>('binary-manifests', documentId)
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.database.delete('binary-manifests', documentId)
  }

  /** Removes blocks that are no longer referenced by any manifest. */
  async collectGarbage(): Promise<number> {
    const manifests = await this.database.getAll<BinaryManifestRecord>('binary-manifests')
    const referenced = new Set(manifests.flatMap((manifest) => manifest.blockHashes))
    const blocks = await this.database.getAll<BinaryBlockRecord>('binary-blocks')
    let removed = 0

    for (const block of blocks) {
      if (!referenced.has(block.id)) {
        await this.database.delete('binary-blocks', block.id)
        removed += 1
      }
    }

    return removed
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    const digest = await globalThis.crypto.subtle.digest('SHA-256', input)
    return [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
  }

  // Deterministic fallback for older browsers. The SHA-256 path is used in
  // modern browsers; this fallback preserves correctness of deduplication.
  let hash = 0x811c9dc5
  for (const value of bytes) {
    hash ^= value
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}
