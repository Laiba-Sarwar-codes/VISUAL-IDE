// app/stores/aiWorkflow.ts
// Module 19 — reactive AI workflow state
// AI Workflow (2026-07-05) — added the structured plan/preview/confirm
// pipeline (generatePlan/applyPlan/cancelPlan/repeatLast) alongside the
// original simple execute() path, which is left completely unchanged for
// backward compatibility. The new pipeline is what the panel now drives
// primarily: every prompt stops at a mandatory preview before anything
// touches the scene.

import { defineStore } from 'pinia'
import { aiWorkflowService } from '~~/src/ai/AIWorkflowService'
import { executeOperation } from '~~/src/ai/OperationExecutor'
import { buildEditorContext } from '~~/src/ai/AIContextBuilder'
import { validatePlan } from '~~/src/ai/AIPlanValidator'
import { executePlan } from '~~/src/ai/AIOperationExecutor'
import { ruleBasedAIProvider } from '~~/src/ai/providers/RuleBasedAIProvider'
import { wasLastRequestServedByWorker } from '~~/src/ai/workers/AIWorkerClient'
import type { AIWorkflowResult } from '~~/src/ai/types'
import type { AIExecutionPlan, AIExecutionResult, AIValidationError } from '~~/src/ai/planTypes'
import type { AISnapshot } from '~~/src/monitoring/types'

type AIPlanState = 'idle' | 'parsing' | 'preview' | 'applying' | 'success' | 'error' | 'cancelled'

function defaultMetrics(): AISnapshot {
  return {
    lastParseDurationMs: 0,
    lastWorkerDurationMs: 0,
    lastValidationDurationMs: 0,
    lastExecutionDurationMs: 0,
    lastOperationCount: 0,
    lastAffectedObjectCount: 0,
    lastProviderId: null,
    lastSuccess: null,
    totalRequests: 0,
    totalCancelled: 0,
    totalFailures: 0,
  }
}

interface AIWorkflowState {
  isOpen: boolean
  instruction: string
  isProcessing: boolean
  lastResult: AIWorkflowResult | null
  history: AIWorkflowResult[]

  currentPlan: AIExecutionPlan | null
  planState: AIPlanState
  validationErrors: AIValidationError[]
  lastExecutionResult: AIExecutionResult | null
  metrics: AISnapshot
}

// Module-level (not store state) — mirrors the `_recording` flag pattern
// in app/stores/scene.ts. Pinia state must stay serializable; an
// AbortController isn't, so it lives alongside the store instead of in it.
let activeAbortController: AbortController | null = null

export const useAIWorkflowStore = defineStore('aiWorkflow', {
  state: (): AIWorkflowState => ({
    isOpen: false,
    instruction: '',
    isProcessing: false,
    lastResult: null,
    history: [],

    currentPlan: null,
    planState: 'idle',
    validationErrors: [],
    lastExecutionResult: null,
    metrics: defaultMetrics(),
  }),

  actions: {
    open(): void { this.isOpen = true },
    close(): void { this.isOpen = false },
    toggle(): void { this.isOpen = !this.isOpen },

    setInstruction(text: string): void {
      this.instruction = text
    },

    /**
     * Why: processes the current instruction through the full AI pipeline
     * and executes all generated operations. Stores the result in history
     * so the user can see what the AI did. Unchanged from before this
     * feature — kept exactly as-is for backward compatibility.
     */
    async execute(): Promise<void> {
      if (!this.instruction.trim()) return
      this.isProcessing = true

      try {
        const result = aiWorkflowService.process(this.instruction)

        if (!result.success) {
          this.lastResult = { ...result }
          this.history.unshift({ ...result })
          return
        }

        // Execute each operation
        const executedOps: string[] = []
        for (const op of result.operations) {
          const execResult = executeOperation(op)
          if (execResult.success) {
            executedOps.push(execResult.message)
          } else {
            this.lastResult = {
              ...result,
              success: false,
              message: execResult.message,
            }
            this.history.unshift({ ...this.lastResult })
            return
          }
        }

        this.lastResult = {
          ...result,
          message: executedOps.join('. '),
        }
        this.history.unshift({ ...this.lastResult })
        this.instruction = ''
      } finally {
        this.isProcessing = false
      }
    },

    clearHistory(): void {
      this.history = []
      this.lastResult = null
    },

    /**
     * Why: the new primary pipeline. Always stops at a preview — never
     * mutates the scene by itself. Uses the real AI worker via
     * RuleBasedAIProvider/AIWorkerClient, falling back to the same pure
     * pipeline on the main thread if the worker is unavailable.
     */
    async generatePlan(): Promise<void> {
      if (!this.instruction.trim()) return

      activeAbortController?.abort()
      const controller = new AbortController()
      activeAbortController = controller

      this.planState = 'parsing'
      this.currentPlan = null
      this.validationErrors = []
      this.metrics.totalRequests += 1

      const prompt = this.instruction
      const parseStart = Date.now()

      try {
        const context = buildEditorContext()
        const plan = await ruleBasedAIProvider.createPlan(prompt, context, controller.signal)
        const parseDuration = Date.now() - parseStart
        this.metrics.lastParseDurationMs = parseDuration
        this.metrics.lastWorkerDurationMs = wasLastRequestServedByWorker() ? parseDuration : 0
        this.metrics.lastProviderId = ruleBasedAIProvider.id

        if (controller.signal.aborted) return

        const validationStart = Date.now()
        const errors = validatePlan(plan, context)
        this.metrics.lastValidationDurationMs = Date.now() - validationStart
        this.validationErrors = errors
        this.metrics.lastOperationCount = plan.operations.length

        const blocking = errors.filter(e => !e.recoverable)
        if (blocking.length > 0 || plan.operations.length === 0) {
          this.currentPlan = plan
          this.planState = 'error'
          this.metrics.totalFailures += 1
          return
        }

        this.currentPlan = plan
        this.planState = 'preview'
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          this.planState = 'cancelled'
          this.metrics.totalCancelled += 1
          return
        }
        this.planState = 'error'
        this.metrics.totalFailures += 1
        this.validationErrors = [{
          code: 'PARSE_FAILURE',
          message: err instanceof Error ? err.message : 'Failed to interpret the instruction.',
          recoverable: false,
        }]
      } finally {
        if (activeAbortController === controller) activeAbortController = null
      }
    },

    /** Executes the current previewed plan as one atomic, undoable transaction (see AIOperationExecutor.ts). */
    async applyPlan(): Promise<void> {
      if (!this.currentPlan || this.planState !== 'preview') return
      this.planState = 'applying'
      const plan = this.currentPlan
      const executionStart = Date.now()

      const result = await executePlan(plan)
      this.metrics.lastExecutionDurationMs = Date.now() - executionStart
      this.metrics.lastAffectedObjectCount = result.affectedObjectIds.length
      this.metrics.lastSuccess = result.success
      if (!result.success) this.metrics.totalFailures += 1

      this.lastExecutionResult = result

      const summaryResult: AIWorkflowResult = {
        success: result.success,
        instruction: plan.originalPrompt,
        parsed: { intent: 'unknown', raw: plan.originalPrompt },
        operations: [],
        message: result.success
          ? `Applied ${result.executedOperationCount} operation${result.executedOperationCount === 1 ? '' : 's'}${result.warnings.length ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? '' : 's'})` : ''}.`
          : (result.error ?? 'AI operation failed and was rolled back.'),
      }
      this.lastResult = summaryResult
      this.history.unshift(summaryResult)

      if (result.success) {
        this.planState = 'success'
        this.currentPlan = null
        this.validationErrors = []
        this.instruction = ''
      } else {
        this.planState = 'error'
      }
    },

    /** Cancels in-flight plan generation, or discards a previewed/errored plan without touching the scene. */
    cancelPlan(): void {
      if (this.planState === 'parsing') {
        activeAbortController?.abort()
        this.metrics.totalCancelled += 1
      }
      this.planState = 'idle'
      this.currentPlan = null
      this.validationErrors = []
    },

    /** Re-runs the most recent instruction from history through the new plan pipeline. */
    async repeatLast(): Promise<void> {
      const last = this.history[0]
      if (!last) return
      this.instruction = last.instruction
      await this.generatePlan()
    },
  },
})
