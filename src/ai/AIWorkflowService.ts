// src/ai/AIWorkflowService.ts
// Module 19 — AI workflow pipeline orchestrator

import { parseInstruction } from './InstructionParser'
import { generateOperations } from './OperationGenerator'
import type { AIWorkflowResult } from './types'

export class AIWorkflowService {
  /**
   * Why: single entry point for the full AI pipeline. The UI calls
   * only this method — it never imports the parser or generator directly.
   * Inputs: raw user instruction string.
   * Output: AIWorkflowResult with success flag, operations, and message.
   * Called by: aiWorkflow Pinia store (Chunk 2).
   */
  process(instruction: string): Omit<AIWorkflowResult, 'executed'> {
    if (!instruction.trim()) {
      return {
        success: false,
        instruction,
        parsed: { intent: 'unknown', raw: instruction },
        operations: [],
        message: 'Please enter an instruction.',
      }
    }

    const parsed = parseInstruction(instruction)
    const { operations, error } = generateOperations(parsed)

    if (error || operations.length === 0) {
      return {
        success: false,
        instruction,
        parsed,
        operations: [],
        message: error ?? 'Could not generate operations from that instruction.',
      }
    }

    return {
      success: true,
      instruction,
      parsed,
      operations,
      message: `Ready to execute ${operations.length} operation${operations.length > 1 ? 's' : ''}.`,
    }
  }
}

export const aiWorkflowService = new AIWorkflowService()