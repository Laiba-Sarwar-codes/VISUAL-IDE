// src/ai/providers/RuleBasedAIProvider.ts
// AI Workflow — the default (and only shipped) AIProvider implementation.
// Tries the real AI worker first (AIWorkerClient -> Priority2WorkerPool ->
// src/priority2/workers/ai.worker.ts), falling back to the identical
// parse+build pipeline on the main thread if the worker is unavailable,
// times out, fails, or is aborted. Always available — pure in-browser
// rule-based logic, no backend, no network call, no API key.

import { nanoid } from 'nanoid'
import { requestPlanFromWorker, buildPlanOnMainThread } from '../workers/AIWorkerClient'
import type { AIEditorContext, AIExecutionPlan } from '../planTypes'
import type { AIProvider } from './AIProvider'

export const ruleBasedAIProvider: AIProvider = {
  id: 'rule-based',
  name: 'Rule-Based Parser',

  async isAvailable(): Promise<boolean> {
    return true
  },

  async createPlan(prompt: string, context: AIEditorContext, signal?: AbortSignal): Promise<AIExecutionPlan> {
    if (!prompt.trim()) {
      return {
        id: nanoid(),
        originalPrompt: prompt,
        summary: 'Please enter an instruction.',
        operations: [],
        warnings: ['Empty instruction.'],
        requiresConfirmation: false,
        createdAt: Date.now(),
      }
    }

    const workerPlan = await requestPlanFromWorker(prompt, context, signal)
    if (workerPlan) return workerPlan

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return buildPlanOnMainThread(prompt, context)
  },
}
