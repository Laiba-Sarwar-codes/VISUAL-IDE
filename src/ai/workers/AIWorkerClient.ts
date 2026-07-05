// src/ai/workers/AIWorkerClient.ts
// AI Workflow — thin client over the real AI worker
// (src/priority2/workers/ai.worker.ts, via Priority2WorkerPool), adding a
// timeout, AbortSignal-based cancellation, and a same-shape fallback to
// running the identical parse+build pipeline synchronously on the main
// thread when the worker is unavailable, times out, fails, or the caller
// cancels. This is what makes the real worker load-bearing for the
// actual AI workflow — not just a health-check command.

import { Priority2WorkerPool } from '../../priority2/workers/Priority2WorkerPool'
import { parsePrompt } from '../AIPromptParser'
import { buildPlan } from '../AIPlanBuilder'
import type { AIEditorContext, AIExecutionPlan } from '../planTypes'

const DEFAULT_TIMEOUT_MS = 4000

let sharedPool: Priority2WorkerPool | null = null
let lastRequestServedByWorker = false

function getPool(): Priority2WorkerPool {
  if (!sharedPool) sharedPool = new Priority2WorkerPool()
  return sharedPool
}

/** Whether the most recent requestPlanFromWorker() call actually got a worker response (vs. returning null for the caller to fall back). Used for monitoring's "worker duration" metric. */
export function wasLastRequestServedByWorker(): boolean {
  return lastRequestServedByWorker
}

/** Same-shape fallback used whenever the worker path is unavailable or fails — identical pipeline, just run synchronously here instead of in the worker thread. */
export function buildPlanOnMainThread(prompt: string, context: AIEditorContext): AIExecutionPlan {
  const steps = parsePrompt(prompt)
  return buildPlan(steps, context, prompt)
}

/**
 * Returns the worker-built plan, or `null` if the worker is unavailable/
 * failed/timed out/was aborted — callers should fall back to
 * `buildPlanOnMainThread` in that case (see RuleBasedAIProvider.ts).
 */
export async function requestPlanFromWorker(
  prompt: string,
  context: AIEditorContext,
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<AIExecutionPlan | null> {
  const pool = getPool()
  if (!pool.available) {
    lastRequestServedByWorker = false
    return null
  }
  if (signal?.aborted) {
    lastRequestServedByWorker = false
    return null
  }

  const request = pool.buildAIPlan(prompt, context)

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('AI worker request timed out.')), timeoutMs)
  })

  const racers: Promise<AIExecutionPlan>[] = [request, timeout]
  if (signal) {
    racers.push(new Promise<never>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
  }

  try {
    const plan = await Promise.race(racers)
    lastRequestServedByWorker = true
    return plan
  } catch {
    lastRequestServedByWorker = false
    return null
  }
}
