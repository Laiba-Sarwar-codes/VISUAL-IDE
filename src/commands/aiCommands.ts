// src/commands/aiCommands.ts
// AI Workflow — command palette entries. Follows the exact literal-array
// pattern in builtInCommands.ts/layerCommands.ts. `ai:open-workflow` keeps
// its original id/shortcut (previously registered ad-hoc in app.vue) so
// no user-facing behavior changes — it's just consolidated here.

import { useAIWorkflowStore } from '../../app/stores/aiWorkflow'
import type { PaletteCommand } from './types'

export function createAICommands(): PaletteCommand[] {
  return [
    {
      id: 'ai:open-workflow',
      label: 'Open AI Workflow',
      category: 'AI',
      icon: '🤖',
      keywords: ['ai', 'workflow', 'natural language', 'generate', 'create'],
      shortcut: 'Cmd+Shift+A',
      handler() {
        useAIWorkflowStore().open()
      },
    },
    {
      id: 'ai:apply-plan',
      label: 'Apply Current AI Plan',
      category: 'AI',
      icon: '✓',
      keywords: ['ai', 'apply', 'confirm', 'run', 'plan'],
      handler() {
        const ai = useAIWorkflowStore()
        if (ai.planState === 'preview') void ai.applyPlan()
      },
    },
    {
      id: 'ai:cancel-plan',
      label: 'Cancel AI Operation',
      category: 'AI',
      icon: '✕',
      keywords: ['ai', 'cancel', 'abort', 'stop'],
      handler() {
        useAIWorkflowStore().cancelPlan()
      },
    },
    {
      id: 'ai:repeat-last',
      label: 'Repeat Last AI Instruction',
      category: 'AI',
      icon: '↻',
      keywords: ['ai', 'repeat', 'again', 'redo instruction'],
      handler() {
        void useAIWorkflowStore().repeatLast()
      },
    },
  ]
}
