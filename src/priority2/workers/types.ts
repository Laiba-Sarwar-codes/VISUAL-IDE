import type { SceneObject } from '../../engine/scene-graph/types'

export interface WorkerRequest<T = unknown> {
  id: string
  type: string
  payload: T
}

export interface WorkerSuccess<T = unknown> {
  id: string
  success: true
  result: T
}

export interface WorkerFailure {
  id: string
  success: false
  error: string
}

export type WorkerResponse<T = unknown> = WorkerSuccess<T> | WorkerFailure

export interface RenderWorkerPayload {
  objects: SceneObject[]
  width: number
  height: number
  background: string
}
