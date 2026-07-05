// src/workers/asset-worker/workerMessages.ts
// Module 13 — typed message contracts for asset worker communication

export type WorkerRequestType = 'process-asset'

export type WorkerResponseType = 'asset-ready' | 'progress' | 'error'

export interface WorkerRequest {
  id: string              // job id — matched to response so promises resolve correctly
  type: WorkerRequestType
  payload: ProcessAssetPayload
}

export interface ProcessAssetPayload {
  fileBuffer: ArrayBuffer  // raw file bytes — transferable, avoids copying
  fileName: string
  mimeType: string
  fileSize: number
}

export interface WorkerResponse {
  id: string               // matches the request id
  type: WorkerResponseType
  payload?: AssetReadyPayload | ProgressPayload
  error?: string
}

export interface AssetReadyPayload {
  width: number
  height: number
  thumbnailDataUrl: string  // base64 thumbnail generated inside worker
  objectUrl?: string        // created on main thread after worker returns
}

export interface ProgressPayload {
  percent: number
  stage: 'reading' | 'extracting' | 'thumbnail'
}