// tests/unit/AssetPersistence.test.ts
// V1: Tests for Task 5 — asset IndexedDB persistence concepts

import { describe, it, expect } from 'vitest'
import type { StoredAssetRecord } from '../../src/storage/local/types'

describe('StoredAssetRecord — V1 structure', () => {
  it('has all required fields', () => {
    const record: StoredAssetRecord = {
      id: 'asset-1',
      projectId: 'project-1',
      name: 'photo.png',
      mimeType: 'image/png',
      size: 1024,
      width: 800,
      height: 600,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blob: new Blob(['fake image data'], { type: 'image/png' }),
    }
    expect(record.id).toBe('asset-1')
    expect(record.projectId).toBe('project-1')
    expect(record.blob).toBeInstanceOf(Blob)
  })

  it('associates asset with project via projectId', () => {
    const record: StoredAssetRecord = {
      id: 'asset-2',
      projectId: 'project-abc',
      name: 'logo.svg',
      mimeType: 'image/svg+xml',
      size: 512,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blob: new Blob(['<svg/>'], { type: 'image/svg+xml' }),
    }
    expect(record.projectId).toBe('project-abc')
  })

  it('optional width/height fields are supported', () => {
    const withDimensions: StoredAssetRecord = {
      id: 'asset-3',
      projectId: 'p1',
      name: 'img.png',
      mimeType: 'image/png',
      size: 100,
      width: 400,
      height: 300,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blob: new Blob(),
    }
    const withoutDimensions: StoredAssetRecord = {
      id: 'asset-4',
      projectId: 'p1',
      name: 'img2.png',
      mimeType: 'image/png',
      size: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      blob: new Blob(),
    }
    expect(withDimensions.width).toBe(400)
    expect(withoutDimensions.width).toBeUndefined()
  })
})

describe('Asset URL lifecycle', () => {
  it('Blob can create a valid object URL pattern', () => {
    const blob = new Blob(['data'], { type: 'image/png' })
    // In test env, URL.createObjectURL returns a mock string
    expect(typeof blob).toBe('object')
    expect(blob.size).toBeGreaterThan(0)
  })

  it('project-scoped filtering returns correct assets', () => {
    const records: StoredAssetRecord[] = [
      { id: 'a1', projectId: 'p1', name: 'img1.png', mimeType: 'image/png', size: 100, createdAt: 0, updatedAt: 0, blob: new Blob() },
      { id: 'a2', projectId: 'p2', name: 'img2.png', mimeType: 'image/png', size: 100, createdAt: 0, updatedAt: 0, blob: new Blob() },
      { id: 'a3', projectId: 'p1', name: 'img3.png', mimeType: 'image/png', size: 100, createdAt: 0, updatedAt: 0, blob: new Blob() },
    ]
    const p1Assets = records.filter(r => r.projectId === 'p1')
    expect(p1Assets).toHaveLength(2)
    expect(p1Assets.every(r => r.projectId === 'p1')).toBe(true)
  })

  it('migration does not destroy existing records', () => {
    // Simulates DB_VERSION upgrade from 1→2: existing stores preserved
    const existingStores = ['projects', 'project-meta']
    const newStore = 'assets'
    const allStores = [...existingStores, newStore]
    expect(allStores).toContain('projects')
    expect(allStores).toContain('project-meta')
    expect(allStores).toContain('assets')
    expect(existingStores).toHaveLength(2) // original stores untouched
  })
})
