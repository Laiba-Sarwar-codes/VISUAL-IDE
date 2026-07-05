// src/storage/binary/AssetProcessor.ts
// Module 13 — worker-first processing with main-thread fallback

import { nanoid } from 'nanoid'
import { workerService } from '../../services/WorkerService'
import { SUPPORTED_MIME_TYPES, MAX_ASSET_SIZE_BYTES } from './types'
import type { Asset } from './types'

const THUMBNAIL_MAX_PX = 120

export type ProgressCallback = (percent: number, stage: string) => void

export async function processFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<Asset> {
  validateFile(file)

  const objectUrl = URL.createObjectURL(file)

  try {
    if (workerService.isAvailable) {
      return await processViaWorker(file, objectUrl, onProgress)
    }
  } catch (err) {
    console.warn('[AssetProcessor] Worker failed, falling back to main thread:', err)
  }

  return await processOnMainThread(file, objectUrl, onProgress)
}

/**
 * Why: sends file to the background worker thread. The worker extracts
 * dimensions and returns a thumbnailDataUrl. We then create the final
 * objectUrl on the main thread since object URLs are main-thread-only.
 * The worker processes the file bytes without blocking the UI.
 */
async function processViaWorker(
  file: File,
  objectUrl: string,
  onProgress?: ProgressCallback
): Promise<Asset> {
  const result = await workerService.processAsset(file, onProgress)

  // Worker returns a placeholder dataUrl — generate real thumbnail on main thread
  // using the dimensions the worker extracted
  const thumbnailUrl = await generateThumbnailMainThread(objectUrl, result.width, result.height, file.type)

  return {
    id: nanoid(),
    name: file.name,
    type: SUPPORTED_MIME_TYPES[file.type]!,
    mimeType: file.type,
    size: file.size,
    width: result.width,
    height: result.height,
    createdAt: Date.now(),
    objectUrl,
    thumbnailUrl,
  }
}

/**
 * Why: fallback path when worker is unavailable (older browsers) or
 * crashes. Identical result to worker path but runs on main thread.
 * Shows same progress callbacks so UI stays consistent.
 */
async function processOnMainThread(
  file: File,
  objectUrl: string,
  onProgress?: ProgressCallback
): Promise<Asset> {
  onProgress?.(10, 'reading')
  const { width, height } = await extractDimensions(objectUrl, file.type)
  onProgress?.(75, 'thumbnail')
  const thumbnailUrl = await generateThumbnailMainThread(objectUrl, width, height, file.type)
  onProgress?.(100, 'thumbnail')

  return {
    id: nanoid(),
    name: file.name,
    type: SUPPORTED_MIME_TYPES[file.type]!,
    mimeType: file.type,
    size: file.size,
    width,
    height,
    createdAt: Date.now(),
    objectUrl,
    thumbnailUrl,
  }
}

function validateFile(file: File): void {
  if (!SUPPORTED_MIME_TYPES[file.type]) {
    throw new Error(`Unsupported file type: ${file.type}. Use PNG, JPEG, GIF, WebP, or SVG.`)
  }
  if (file.size > MAX_ASSET_SIZE_BYTES) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max 20MB.`)
  }
}

async function extractDimensions(
  objectUrl: string,
  mimeType: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({
      width: img.naturalWidth || 400,
      height: img.naturalHeight || 400,
    })
    img.onerror = () => resolve({ width: 400, height: 400 })
    img.src = objectUrl
    if (mimeType === 'image/svg+xml') img.crossOrigin = 'anonymous'
  })
}

async function generateThumbnailMainThread(
  objectUrl: string,
  width: number,
  height: number,
  mimeType: string
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    if (mimeType === 'image/svg+xml') img.crossOrigin = 'anonymous'
    img.onload = () => {
      const scale = Math.min(THUMBNAIL_MAX_PX / width, THUMBNAIL_MAX_PX / height, 1)
      const tw = Math.max(1, Math.round(width * scale))
      const th = Math.max(1, Math.round(height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, tw, th)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve('')
    img.src = objectUrl
  })
}

export function revokeAsset(asset: Asset): void {
  if (asset.objectUrl) URL.revokeObjectURL(asset.objectUrl)
}
/**
 * V1: Exported for use by AssetStore when reconstructing assets from
 * stored blobs on project load. Avoids duplicating thumbnail logic.
 */
export async function generateThumbnailFromBlob(
  blob: Blob,
  width: number,
  height: number
): Promise<string> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    return await generateThumbnailMainThread(objectUrl, width, height, blob.type)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
