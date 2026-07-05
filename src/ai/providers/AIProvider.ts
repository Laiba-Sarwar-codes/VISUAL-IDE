// src/ai/providers/AIProvider.ts
// AI Workflow — provider abstraction so the system can support both the
// current rule-based parser and, later, optional AI models without
// touching any call site. Only `RuleBasedAIProvider` ships as a working
// implementation today: a `BrowserModelAIProvider`/`RemoteAIProvider`
// stub with no real model behind it would be an unused, non-functional
// placeholder, which this project's own guidelines treat as worse than
// not having it — this interface is written so either can be added later
// without changing any consumer. Nothing here requires a backend, reads
// an API key, or sends project data anywhere by default.

import type { AIEditorContext, AIExecutionPlan } from '../planTypes'

export interface AIProvider {
  id: string
  name: string
  isAvailable(): Promise<boolean>
  createPlan(
    prompt: string,
    context: AIEditorContext,
    signal?: AbortSignal
  ): Promise<AIExecutionPlan>
}
