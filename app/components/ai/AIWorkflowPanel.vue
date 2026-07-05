<!-- app/components/ai/AIWorkflowPanel.vue -->
<!-- Module 19 — AI workflow input panel -->
<template>
  <div v-if="ai.isOpen" class="ai-overlay">
    <div class="ai-panel">

      <PageHeader
        :icon="WandSparkles"
        title="AI Workflow"
        description="Describe what you want to create or change in plain language — every request shows a preview before anything touches the canvas."
        @back="ai.close()"
      />

      <div class="ai-body">
        <p class="ai-hint">
          Describe what you want to create or change. Examples:
        </p>
        <div class="examples">
          <button
            v-for="ex in examples"
            :key="ex"
            class="example-chip"
            @click="useExample(ex)"
          >{{ ex }}</button>
        </div>

        <div class="input-row">
          <input
            ref="inputRef"
            v-model="localInstruction"
            class="ai-input"
            placeholder="Create 3 blue rectangles…"
            :disabled="isBusy"
            @keydown.enter="handleSubmit"
            @keydown.escape="ai.close()"
            @input="ai.setInstruction(localInstruction)"
          />
          <button
            class="run-btn"
            :disabled="isBusy || !localInstruction.trim()"
            @click="handleSubmit"
          >
            {{ ai.planState === 'parsing' ? '…' : '▶ Run' }}
          </button>
        </div>

        <!-- Parsing state -->
        <div v-if="ai.planState === 'parsing'" class="status-line" role="status">
          <span class="spinner" aria-hidden="true">⏳</span>
          <span>Interpreting your request…</span>
          <button class="cancel-inline-btn" @click="ai.cancelPlan()">Cancel</button>
        </div>

        <!-- Preview state -->
        <div v-if="ai.planState === 'preview' && ai.currentPlan" class="preview-panel">
          <div class="preview-header">
            <span class="preview-title">Preview</span>
            <span class="preview-count">
              {{ ai.currentPlan.operations.length }} operation{{ ai.currentPlan.operations.length === 1 ? '' : 's' }}
            </span>
          </div>
          <p class="preview-prompt">"{{ ai.currentPlan.originalPrompt }}"</p>
          <ul class="preview-ops">
            <li v-for="op in ai.currentPlan.operations" :key="op.id">{{ op.description ?? op.type }}</li>
          </ul>
          <div v-if="ai.currentPlan.warnings.length > 0" class="preview-warnings">
            <div v-for="(w, i) in ai.currentPlan.warnings" :key="i" class="warning-item">⚠ {{ w }}</div>
          </div>
          <div class="preview-actions">
            <button class="apply-btn" :disabled="isBusy" @click="ai.applyPlan()">✓ Apply</button>
            <button class="cancel-btn" @click="ai.cancelPlan()">Cancel</button>
          </div>
        </div>

        <!-- Applying state -->
        <div v-if="ai.planState === 'applying'" class="status-line" role="status">
          <span class="spinner" aria-hidden="true">⏳</span>
          <span>Applying…</span>
        </div>

        <!-- Blocked / errored plan -->
        <div v-if="ai.planState === 'error' && ai.currentPlan" class="preview-panel error-panel">
          <div class="preview-header">
            <span class="preview-title">Couldn't safely apply this</span>
          </div>
          <div v-for="(e, i) in ai.validationErrors" :key="`e-${i}`" class="warning-item">✕ {{ e.message }}</div>
          <div v-for="(w, i) in ai.currentPlan.warnings" :key="`w-${i}`" class="warning-item">⚠ {{ w }}</div>
          <div class="preview-actions">
            <button class="cancel-btn" @click="ai.cancelPlan()">Dismiss</button>
          </div>
        </div>

        <!-- Result (legacy pipeline + post-apply summary) -->
        <div v-if="ai.lastResult && ai.planState !== 'preview' && ai.planState !== 'error'" class="result" :class="ai.lastResult.success ? 'success' : 'error'">
          <span class="result-icon">{{ ai.lastResult.success ? '✓' : '✕' }}</span>
          <span class="result-msg">{{ ai.lastResult.message }}</span>
        </div>

        <!-- History -->
        <div v-if="ai.history.length > 0" class="history-section">
          <div class="history-header">
            <span>Recent</span>
            <button class="clear-btn" @click="ai.clearHistory()">Clear</button>
          </div>
          <div
            v-for="(item, i) in ai.history.slice(0, 5)"
            :key="i"
            class="history-item"
            :class="item.success ? 'success' : 'error'"
            @click="ai.setInstruction(item.instruction); localInstruction = item.instruction"
          >
            <span class="h-icon">{{ item.success ? '✓' : '✕' }}</span>
            <span class="h-text">{{ item.instruction }}</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { WandSparkles } from 'lucide-vue-next'
import { useAIWorkflowStore } from '~/stores/aiWorkflow'
import PageHeader from '~/components/app-shell/PageHeader.vue'

const ai = useAIWorkflowStore()
const inputRef = ref<HTMLInputElement | null>(null)
const localInstruction = ref('')

const examples = [
  'Create 3 blue rectangles',
  'Add a text saying Hello',
  'Create 2 green circles',
  'Delete selected object',
  'Change color to red',
  'Center all objects',
]

const isBusy = computed(() => ai.planState === 'parsing' || ai.planState === 'applying')

/** Runs the current instruction through the new plan/preview pipeline (the actual AI worker + validated plan). */
async function handleSubmit(): Promise<void> {
  if (!localInstruction.value.trim() || isBusy.value) return
  ai.setInstruction(localInstruction.value)
  await ai.generatePlan()
}

watch(() => ai.isOpen, async (open) => {
  if (open) {
    await nextTick()
    inputRef.value?.focus()
  }
})

// Pre-existing quirk fixed in passing: example chips previously only set
// the store's instruction, not this component's own v-model, so the Run
// button stayed disabled after clicking one. Kept minimal since it's on
// the same line already being touched.
function useExample(ex: string): void {
  ai.setInstruction(ex)
  localInstruction.value = ex
}
</script>

<style scoped>
.ai-overlay {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.ai-panel {
  display: flex; flex-direction: column; flex: 1; min-height: 0;
}
.ai-body {
  max-width: 640px; width: 100%; margin: 0 auto;
  padding: 20px 24px 32px; display: flex; flex-direction: column; gap: 12px;
}
.ai-hint { color: var(--text-muted); font-size: 12px; margin: 0; }
.examples { display: flex; flex-wrap: wrap; gap: 6px; }
.example-chip {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 16px;
  color: var(--text-secondary); font-size: 11px; padding: 4px 10px; cursor: pointer;
}
.example-chip:hover { background: var(--hover); color: var(--text-primary); }
.input-row { display: flex; gap: 8px; }
.ai-input {
  flex: 1; background: var(--surface-0); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-primary); font-size: 13px; padding: 10px 12px; outline: none;
}
.ai-input:focus { border-color: var(--accent); }
.run-btn {
  background: var(--accent); border: none; border-radius: 8px;
  color: #ffffff; font-size: 13px; padding: 0 16px; cursor: pointer;
  white-space: nowrap; font-weight: 500;
}
.run-btn:hover:not(:disabled) { background: var(--accent-strong); }
.run-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.result {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-radius: 8px; font-size: 12px;
}
.result.success { background: var(--success-soft); color: var(--success); }
.result.error   { background: var(--danger-soft); color: var(--danger); }
.result-icon { font-size: 14px; flex-shrink: 0; }
.history-section { display: flex; flex-direction: column; gap: 4px; }
.history-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;
}
.clear-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 10px; }
.clear-btn:hover { color: var(--danger); }
.history-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  background: var(--surface-0); border-radius: 6px; cursor: pointer; font-size: 12px;
}
.history-item:hover { background: var(--hover); }
.history-item.success .h-icon { color: var(--success); }
.history-item.error   .h-icon { color: var(--danger); }
.h-text { color: var(--text-secondary); }

.status-line {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-secondary); font-size: 12px;
}
.spinner { display: inline-block; animation: ai-spin 1.2s linear infinite; }
@keyframes ai-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
.cancel-inline-btn {
  margin-left: auto; background: none; border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-secondary); font-size: 11px; padding: 3px 9px; cursor: pointer;
}
.cancel-inline-btn:hover { border-color: var(--danger); color: var(--danger); }

.preview-panel {
  display: flex; flex-direction: column; gap: 8px; padding: 12px;
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 10px;
}
.preview-panel.error-panel { border-color: var(--danger); }
.preview-header { display: flex; align-items: center; justify-content: space-between; }
.preview-title { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.preview-count { font-size: 10px; color: var(--text-muted); }
.preview-prompt { margin: 0; color: var(--text-muted); font-size: 11px; font-style: italic; }
.preview-ops { margin: 0; padding-left: 18px; color: var(--text-secondary); font-size: 12px; display: flex; flex-direction: column; gap: 3px; }
.preview-warnings { display: flex; flex-direction: column; gap: 4px; }
.warning-item { color: var(--warning); font-size: 11px; }
.error-panel .warning-item:first-of-type { color: var(--danger); }
.preview-actions { display: flex; gap: 8px; margin-top: 4px; }
.apply-btn {
  flex: 1; background: var(--success); border: none; border-radius: 8px;
  color: #06210f; font-size: 12px; font-weight: 600; padding: 8px 0; cursor: pointer;
}
.apply-btn:hover:not(:disabled) { filter: brightness(0.92); }
.apply-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cancel-btn {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-secondary); font-size: 12px; padding: 8px 14px; cursor: pointer;
}
.cancel-btn:hover { border-color: var(--danger); color: var(--danger); }
</style>