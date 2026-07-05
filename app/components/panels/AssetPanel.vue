<!-- app/components/panels/AssetPanel.vue -->
<template>
  <section class="asset-panel" aria-label="Assets">
    <div class="panel-header">
      <div class="panel-heading">
        <span class="panel-kicker">Library</span>
        <strong>Assets</strong>
      </div>
      <span class="asset-count">{{ assets.assets.length }}</span>
    </div>

    <div class="upload-area">
      <label class="upload-btn">
        <span class="upload-icon" aria-hidden="true">＋</span>
        <span>
          <strong>Upload media</strong>
          <small>PNG, JPG, WebP or SVG</small>
        </span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          multiple
          hidden
          @change="handleUpload"
        />
      </label>

      <div v-if="assets.uploadProgress" class="progress-wrap">
        <div class="progress-info">
          <span class="progress-name">{{ assets.uploadProgress.fileName }}</span>
          <span class="progress-stage">{{ assets.uploadProgress.stage }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${assets.uploadProgress.percent}%` }" />
        </div>
        <span class="progress-pct">{{ assets.uploadProgress.percent }}%</span>
      </div>

      <p v-if="assets.lastError" class="error-msg">{{ assets.lastError }}</p>
    </div>

    <div v-if="assets.assets.length === 0" class="asset-empty">
      <div class="empty-icon" aria-hidden="true">▧</div>
      <strong>No assets uploaded</strong>
      <p>Uploaded images are stored locally in this project and can be placed on the canvas.</p>
    </div>

    <div v-else class="asset-grid">
      <article v-for="asset in assets.assets" :key="asset.id" class="asset-tile" :title="asset.name">
        <button type="button" class="asset-preview" :aria-label="`Add ${asset.name} to canvas`" @click="addToCanvas(asset)">
          <img
            v-if="asset.thumbnailUrl && !asset.thumbnailUrl.startsWith('data:worker')"
            :src="asset.thumbnailUrl"
            class="asset-thumb"
            :alt="asset.name"
          />
          <span v-else class="asset-thumb placeholder">
            {{ asset.type === 'svg' ? 'SVG' : 'IMG' }}
          </span>
          <span class="add-badge" aria-hidden="true">＋</span>
        </button>

        <span class="asset-name">{{ shortName(asset.name) }}</span>

        <div class="asset-actions">
          <button type="button" title="Add to canvas" :aria-label="`Add ${asset.name} to canvas`" @click="addToCanvas(asset)">Add</button>
          <button type="button" title="Delete asset" class="danger" :aria-label="`Delete ${asset.name}`" @click="assets.removeAsset(asset.id)">Delete</button>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useAssetStore } from '~/stores/asset'
import { useSceneStore } from '~/stores/scene'
import { useEditorStore } from '~/stores/editor'
import type { Asset } from '~~/src/storage/binary/types'

const assets = useAssetStore()
const scene = useSceneStore()
const editor = useEditorStore()

async function handleUpload(e: Event): Promise<void> {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    await assets.addFromFile(file)
  }
  ;(e.target as HTMLInputElement).value = ''
}

function addToCanvas(asset: Asset): void {
  scene.addObject({
    type: 'image',
    name: asset.name,
    x: 0,
    y: 0,
    width: Math.min(asset.width, 400),
    height: Math.min(asset.height, 400),
    assetId: asset.id,
  })
  editor.setStatusMessage(`Added: ${asset.name}`)
}

function shortName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 16)}…` : name
}
</script>

<style scoped>
.asset-panel {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-1);
}

.panel-header {
  min-height: 58px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 13px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.015), transparent);
  flex-shrink: 0;
}

.panel-heading { display: flex; flex-direction: column; gap: 1px; }
.panel-kicker { color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: 0.11em; }
.panel-heading strong { color: var(--text-primary); font-size: 13px; font-weight: 650; }
.asset-count { min-width: 24px; height: 22px; display: grid; place-items: center; padding: 0 7px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface-2); color: var(--text-secondary); font: 600 10px/1 ui-monospace, monospace; }

.upload-area { padding: 10px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; }
.upload-btn { display: flex; align-items: center; gap: 9px; min-height: 54px; padding: 9px 10px; border: 1px dashed #3b4860; border-radius: var(--radius-md); background: rgba(8,12,19,0.38); color: var(--text-secondary); cursor: pointer; transition: border-color 120ms ease, background 120ms ease; }
.upload-btn:hover { border-color: var(--accent); background: var(--accent-soft); }
.upload-icon { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--accent); font-size: 18px; flex-shrink: 0; }
.upload-btn > span:last-of-type { display: flex; flex-direction: column; gap: 2px; }
.upload-btn strong { color: var(--text-primary); font-size: 11px; font-weight: 650; }
.upload-btn small { color: var(--text-muted); font-size: 9px; }

.progress-wrap { position: relative; margin-top: 8px; padding: 8px; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--surface-0); }
.progress-info { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 6px; color: var(--text-muted); font-size: 9px; }
.progress-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.progress-stage { color: #aeb2ff; text-transform: capitalize; }
.progress-bar { height: 4px; overflow: hidden; border-radius: 999px; background: var(--surface-3); }
.progress-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent-strong), #a78bfa); transition: width 150ms ease; }
.progress-pct { display: block; margin-top: 4px; color: var(--text-muted); font: 600 8px/1 ui-monospace, monospace; text-align: right; }
.error-msg { margin: 7px 0 0; color: var(--danger); font-size: 9px; line-height: 1.45; }

.asset-empty { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; padding: 20px 16px; text-align: center; }
.empty-icon { width: 42px; height: 42px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 13px; background: var(--surface-2); color: var(--accent); font-size: 18px; }
.asset-empty strong { color: var(--text-secondary); font-size: 11px; }
.asset-empty p { max-width: 190px; margin: 0; color: var(--text-muted); font-size: 9px; line-height: 1.55; }

.asset-grid { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 8px; padding: 9px; }
.asset-tile { min-width: 0; display: flex; flex-direction: column; gap: 6px; padding: 7px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: rgba(8,12,19,0.32); transition: border-color 120ms ease, background 120ms ease, transform 120ms ease; }
.asset-tile:hover { border-color: #38455d; background: var(--surface-2); transform: translateY(-1px); }
.asset-preview { position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden; display: block; padding: 0; border: 1px solid var(--border-subtle); border-radius: 7px; background: var(--surface-0); cursor: pointer; }
.asset-thumb { width: 100%; height: 100%; display: block; object-fit: contain; }
.asset-thumb.placeholder { display: grid; place-items: center; color: var(--text-muted); font: 700 10px/1 ui-monospace, monospace; }
.add-badge { position: absolute; right: 5px; bottom: 5px; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 7px; background: rgba(99,102,241,0.94); color: #fff; font-size: 14px; opacity: 0; transform: translateY(3px); transition: opacity 120ms ease, transform 120ms ease; }
.asset-preview:hover .add-badge { opacity: 1; transform: translateY(0); }
.asset-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); font-size: 9px; text-align: center; }
.asset-actions { display: flex; gap: 5px; opacity: 0; transition: opacity 120ms ease; }
.asset-tile:hover .asset-actions { opacity: 1; }
.asset-actions button { flex: 1; height: 23px; padding: 0 5px; border: 1px solid var(--border); border-radius: 5px; background: var(--surface-2); color: var(--text-muted); cursor: pointer; font-size: 8px; }
.asset-actions button:hover { border-color: rgba(129,140,248,0.32); color: var(--text-primary); }
.asset-actions button.danger:hover { border-color: rgba(251,113,133,0.35); background: rgba(251,113,133,0.08); color: var(--danger); }

@media (max-width: 980px) {
  .asset-grid { grid-template-columns: 1fr; }
}
</style>
