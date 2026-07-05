// src/storage/binary/types.ts
// Module 12 — asset type definitions

export type AssetType = 'image' | 'svg'

export interface Asset {
  id: string
  name: string
  type: AssetType
  mimeType: string
  size: number          // bytes
  width: number         // original pixel width
  height: number        // original pixel height
  createdAt: number
  objectUrl: string     // revocable URL for rendering (URL.createObjectURL)
  thumbnailUrl: string  // small base64 data URL for the asset panel preview
}

export const SUPPORTED_MIME_TYPES: Record<string, AssetType> = {
  'image/png':     'image',
  'image/jpeg':    'image',
  'image/gif':     'image',
  'image/webp':    'image',
  'image/svg+xml': 'svg',
}

export const MAX_ASSET_SIZE_BYTES = 20 * 1024 * 1024 // 20MB