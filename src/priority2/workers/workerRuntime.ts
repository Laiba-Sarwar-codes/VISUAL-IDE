import type { WorkerRequest, WorkerResponse } from './types'

export function installWorkerHandler(
  handler: (request: WorkerRequest) => Promise<unknown> | unknown,
): void {
  const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
    postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void
  }

  scope.onmessage = (event) => {
    Promise.resolve(handler(event.data))
      .then((result) => {
        const response: WorkerResponse = { id: event.data.id, success: true, result }
        scope.postMessage(response)
      })
      .catch((error: unknown) => {
        const response: WorkerResponse = {
          id: event.data.id,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
        scope.postMessage(response)
      })
  }
}
