<!-- app/components/editor/ExportDialog.vue -->
<!-- Module 22 — Export dialog UI -->
<template>
  <div v-if="exportStore.isDialogOpen" class="export-overlay">
    <div class="export-dialog">

      <PageHeader
        :icon="Download"
        title="Export Scene"
        description="Export the current scene as an image or document. Preview settings before exporting."
        @back="exportStore.closeDialog()"
      />

      <div class="dialog-body">

        <!-- Format selector -->
        <div class="field">
          <label class="field-label">Format</label>
          <div class="format-grid">
            <button
              v-for="exporter in exportStore.availableExporters"
              :key="exporter.id"
              class="format-btn"
              :class="{ active: exportStore.selectedFormat === exporter.format }"
              @click="exportStore.setFormat(exporter.format)"
            >
              <span class="format-name">{{ exporter.label }}</span>
              <span class="format-desc">{{ exporter.description }}</span>
            </button>
          </div>
        </div>

        <!-- File name -->
        <div class="field">
          <label class="field-label">File name</label>
          <input
            v-model="fileName"
            class="text-input"
            :placeholder="`my-design.${exportStore.selectedFormat}`"
          />
        </div>

        <!-- PNG-only options -->
        <template v-if="exportStore.selectedFormat === 'png'">
          <div class="field">
            <label class="field-label">Scale</label>
            <div class="scale-row">
              <button
                v-for="s in [1, 2, 3, 4]"
                :key="s"
                class="scale-btn"
                :class="{ active: scale === s }"
                @click="scale = s"
              >{{ s }}×</button>
            </div>
          </div>

          <div class="field">
            <label class="field-label">Background</label>
            <div class="bg-row">
              <button
                class="bg-btn"
                :class="{ active: background === 'transparent' }"
                @click="background = 'transparent'"
              >Transparent</button>
              <button
                class="bg-btn"
                :class="{ active: background === '#ffffff' }"
                @click="background = '#ffffff'"
              >White</button>
              <button
                class="bg-btn"
                :class="{ active: background === '#000000' }"
                @click="background = '#000000'"
              >Black</button>
              <input
                type="color"
                class="color-input"
                :value="isCustomBg ? background : '#ffffff'"
                @input="background = ($event.target as HTMLInputElement).value"
                title="Custom color"
              />
            </div>
          </div>
        </template>

        <!-- Include hidden -->
        <div class="field field-row">
          <label class="toggle-label">
            <input v-model="includeInvisible" type="checkbox" class="checkbox" />
            Include hidden objects
          </label>
        </div>

        <!-- Result message -->
        <div v-if="exportStore.lastResult" class="result" :class="exportStore.lastResult.success ? 'success' : 'error'">
          <span>{{ exportStore.lastResult.success ? '✓' : '✕' }}</span>
          <span>{{ exportStore.lastResult.message }}</span>
        </div>

      </div>

      <div class="dialog-footer">
        <button class="cancel-btn" @click="exportStore.closeDialog()">Cancel</button>
        <button
          class="export-btn"
          :disabled="exportStore.isExporting"
          @click="handleExport"
        >
          {{ exportStore.isExporting ? 'Exporting…' : `Export ${exportStore.selectedFormat.toUpperCase()}` }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download } from 'lucide-vue-next'
import { useExportStore } from '~/stores/export'
import PageHeader from '~/components/app-shell/PageHeader.vue'

const exportStore = useExportStore()

const fileName      = ref('')
const scale         = ref(2)
const background    = ref('transparent')
const includeInvisible = ref(false)

const isCustomBg = computed(() =>
  background.value !== 'transparent' &&
  background.value !== '#ffffff' &&
  background.value !== '#000000'
)

async function handleExport(): Promise<void> {
  await exportStore.exportScene({
    fileName:        fileName.value.trim() || undefined,
    scale:           scale.value,
    background:      background.value,
    includeInvisible: includeInvisible.value,
  })
}
</script>

<style scoped>
.export-overlay {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.export-dialog {
  display: flex; flex-direction: column; flex: 1; min-height: 0;
}
.dialog-body {
  max-width: 560px; width: 100%; margin: 0 auto;
  padding: 20px 24px; display: flex; flex-direction: column; gap: 16px;
}
.field { display: flex; flex-direction: column; gap: 6px; }
.field-row { flex-direction: row; align-items: center; }
.field-label {
  font-size: 11px; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: 0.5px;
}
.text-input {
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-primary); font-size: 13px; padding: 8px 10px; outline: none;
}
.text-input:focus { border-color: var(--accent); }
.format-grid { display: flex; flex-direction: column; gap: 6px; }
.format-btn {
  display: flex; flex-direction: column; gap: 2px;
  background: var(--surface-0); border: 1px solid var(--border);
  border-radius: 8px; padding: 10px 14px; cursor: pointer; text-align: left;
}
.format-btn.active { border-color: var(--accent); background: var(--accent-soft); }
.format-btn:hover:not(.active) { background: var(--hover); }
.format-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.format-desc { font-size: 11px; color: var(--text-muted); }
.scale-row { display: flex; gap: 6px; }
.scale-btn {
  flex: 1; background: var(--surface-0); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-secondary); font-size: 13px; padding: 6px 0; cursor: pointer;
}
.scale-btn.active { background: var(--accent-soft); border-color: var(--accent); color: var(--text-primary); }
.bg-row { display: flex; gap: 6px; align-items: center; }
.bg-btn {
  padding: 6px 12px; background: var(--surface-0); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-secondary); font-size: 12px; cursor: pointer;
}
.bg-btn.active { border-color: var(--accent); color: var(--text-primary); background: var(--accent-soft); }
.color-input { width: 32px; height: 32px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; background: none; padding: 0; }
.toggle-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
.checkbox { accent-color: var(--accent); }
.result {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-radius: 8px; font-size: 12px;
}
.result.success { background: var(--success-soft); color: var(--success); }
.result.error   { background: var(--danger-soft); color: var(--danger); }
.dialog-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  max-width: 560px; width: 100%; margin: 0 auto;
  padding: 16px 24px 24px; border-top: 1px solid var(--border-subtle);
}
.cancel-btn {
  padding: 8px 16px; background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-secondary); font-size: 13px; cursor: pointer;
}
.cancel-btn:hover { background: var(--hover); color: var(--text-primary); }
.export-btn {
  padding: 8px 20px; background: var(--accent); border: none;
  border-radius: 6px; color: #ffffff; font-size: 13px; cursor: pointer; font-weight: 500;
}
.export-btn:hover:not(:disabled) { background: var(--accent-strong); }
.export-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>