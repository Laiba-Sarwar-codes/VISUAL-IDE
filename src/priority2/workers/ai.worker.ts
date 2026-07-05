import { installWorkerHandler } from './workerRuntime'
import { parsePrompt } from '../../ai/AIPromptParser'
import { buildPlan } from '../../ai/AIPlanBuilder'
import type { AIEditorContext } from '../../ai/planTypes'

installWorkerHandler((request) => {
  // Real AI Workflow pipeline — parsing/reference-resolution/plan-building
  // run here, off the main thread. Scene mutation never happens in the
  // worker; the returned plan is executed on the main thread via the
  // existing scene/selection store actions (see AIOperationExecutor.ts).
  if (request.type === 'build-plan') {
    const payload = request.payload as { prompt: string; context: AIEditorContext }
    const steps = parsePrompt(payload.prompt)
    return buildPlan(steps, payload.context, payload.prompt)
  }

  if (request.type !== 'parse-instruction') throw new Error(`Unknown AI worker request: ${request.type}`)
  const payload = request.payload as { instruction: string }
  const normalized = payload.instruction.trim().toLowerCase()
  const operations: Array<Record<string, string | number>> = []

  const countMatch = normalized.match(/(?:create|add|draw)\s+(\d+)\s+/)
  const count = Math.max(1, Number(countMatch?.[1] ?? 1))
  const shape = normalized.includes('circle') || normalized.includes('ellipse')
    ? 'ellipse'
    : normalized.includes('text')
      ? 'text'
      : 'rectangle'

  if (/\b(create|add|draw)\b/.test(normalized)) {
    for (let index = 0; index < count; index += 1) {
      operations.push({ type: 'create', shape, index })
    }
  }

  return { normalized, operations, confidence: operations.length > 0 ? 0.8 : 0.2 }
})
