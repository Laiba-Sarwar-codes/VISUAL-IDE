// app/stores/asset.ts
// V1: Assets persisted in IndexedDB — object URLs recreated on load

import { defineStore } from 'pinia'
import { processFile, revokeAsset } from '~~/src/storage/binary/AssetProcessor'
import { IndexedDBService } from '~~/src/storage/local/IndexedDBService'
import type { Asset } from '~~/src/storage/binary/types'
import type { StoredAssetRecord } from '~~/src/storage/local/types'

interface UploadProgress {
  fileName: string
  percent: number
  stage: string
}

interface AssetState {
  assets: Asset[]
  isLoading: boolean
  lastError: string | null
  uploadProgress: UploadProgress | null
}

export const useAssetStore = defineStore('asset', {
  state: (): AssetState => ({
    assets: [],
    isLoading: false,
    lastError: null,
    uploadProgress: null,
  }),

  getters: {
    getById: (state) => (id: string): Asset | undefined =>
      state.assets.find(a => a.id === id),
    imageAssets: (state): Asset[] => state.assets.filter(a => a.type === 'image'),
    svgAssets: (state): Asset[] => state.assets.filter(a => a.type === 'svg'),
  },

  actions: {
    /**
     * V1: After processing the file in memory, persist a StoredAssetRecord
     * to IndexedDB so the asset survives page refresh. The object URL is
     * a temporary display handle — recreated from the blob on load.
     */
    async addFromFile(file: File, projectId?: string): Promise<Asset | null> {
      this.isLoading = true
      this.lastError = null
      this.uploadProgress = { fileName: file.name, percent: 0, stage: 'reading' }

      try {
        const asset = await processFile(file, (percent, stage) => {
          this.uploadProgress = { fileName: file.name, percent, stage }
        })
        this.assets.push(asset)
        this.uploadProgress = null

        // V1: persist blob to IndexedDB if we have a project context
        if (projectId) {
          await this.persistAsset(asset, file, projectId)
        }

        return asset
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : 'Upload failed'
        this.uploadProgress = null
        return null
      } finally {
        this.isLoading = false
      }
    },

    async persistAsset(asset: Asset, file: File, projectId: string): Promise<void> {
      try {
        const record: StoredAssetRecord = {
          id: asset.id,
          projectId,
          name: asset.name,
          mimeType: asset.mimeType,
          size: asset.size,
          width: asset.width,
          height: asset.height,
          createdAt: asset.createdAt,
          updatedAt: Date.now(),
          blob: file,
        }
        await IndexedDBService.setAsset(record)
      } catch (err) {
        console.warn('[AssetStore] Failed to persist asset to IndexedDB:', err)
      }
    },

    /**
     * V1: Load all assets for a project from IndexedDB. Recreates
     * temporary object URLs from stored blobs. Handles corrupted records
     * gracefully — skips them rather than crashing the editor.
     */
    async loadProjectAssets(projectId: string): Promise<void> {
      try {
        const records = await IndexedDBService.getAssetsByProject(projectId)
        const loadedAssets: Asset[] = []

        for (const record of records) {
          try {
            if (!record.blob) continue
            const objectUrl = URL.createObjectURL(record.blob)

            // Regenerate thumbnail from blob
            const { generateThumbnailFromBlob } = await import('~~/src/storage/binary/AssetProcessor')
            const thumbnailUrl = await generateThumbnailFromBlob(record.blob, record.width ?? 400, record.height ?? 400)

            const { SUPPORTED_MIME_TYPES } = await import('~~/src/storage/binary/types')
            const assetType = SUPPORTED_MIME_TYPES[record.mimeType] ?? 'image'

            loadedAssets.push({
              id: record.id,
              name: record.name,
              type: assetType,
              mimeType: record.mimeType,
              size: record.size,
              width: record.width ?? 400,
              height: record.height ?? 400,
              createdAt: record.createdAt,
              objectUrl,
              thumbnailUrl,
            })
          } catch (err) {
            console.warn('[AssetStore] Skipping corrupted asset record:', record.id, err)
          }
        }

        // Revoke old object URLs before replacing
        for (const existing of this.assets) {
          revokeAsset(existing)
        }
        this.assets = loadedAssets
      } catch (err) {
        console.warn('[AssetStore] Failed to load project assets:', err)
      }
    },

    async removeAsset(id: string, projectId?: string): Promise<void> {
      const asset = this.assets.find(a => a.id === id)
      if (asset) revokeAsset(asset)
      this.assets = this.assets.filter(a => a.id !== id)

      // V1: delete from IndexedDB
      try {
        await IndexedDBService.removeAsset(id)
      } catch (err) {
        console.warn('[AssetStore] Failed to remove asset from IndexedDB:', err)
      }
    },

    /**
     * V1: Delete all assets for a project — called when project is deleted.
     */
    async removeProjectAssets(projectId: string): Promise<void> {
      try {
        const records = await IndexedDBService.getAssetsByProject(projectId)
        for (const record of records) {
          await IndexedDBService.removeAsset(record.id)
        }
        // Revoke any in-memory object URLs for this project's assets
        for (const asset of this.assets) {
          revokeAsset(asset)
        }
        this.assets = []
      } catch (err) {
        console.warn('[AssetStore] Failed to remove project assets:', err)
      }
    },
  },
})
