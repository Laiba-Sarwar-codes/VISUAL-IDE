<!-- app/components/collaboration/CollaborationPanel.vue -->
<!-- Module 15 — join/leave room UI -->
<!-- Direct Link mode (backend-free, WebRTC + manual SDP token exchange) is the -->
<!-- default tab so collaboration works with no server involved. Online Room -->
<!-- mode uses the same-origin Nitro WebSocket route in production. During local -->
<!-- Nuxt development it requires `npm run dev:with-signaling`. -->
<template>
  <div v-if="collabUI.isOpen" class="collab-overlay">
    <div class="collab-panel">
      <PageHeader
        :icon="Users"
        title="Collaborate"
        description="Connect peer-to-peer with a direct link, or join an online room."
        @back="collabUI.close()"
      />

      <div class="tab-row">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'manual' }"
          @click="activeTab = 'manual'"
        >
          Direct Link (No Server)
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'room' }"
          @click="activeTab = 'room'"
        >
          Online Room
        </button>
      </div>

      <div class="panel-body">
        <!-- ── Direct Link (backend-free) ────────────────────────────── -->
        <template v-if="activeTab === 'manual'">
          <div class="status-row">
            <span class="status-dot" :class="manualState"></span>
            <span class="status-text">{{ manualStatusLabel }}</span>
          </div>

          <template v-if="manualRole === 'none'">
            <p class="hint">
              Connect peer-to-peer with a copy/paste link — no server required.
            </p>
            <button class="btn-primary" :disabled="manualBusy" @click="startHosting">
              Start Session (Invite Someone)
            </button>
            <button class="btn-secondary" :disabled="manualBusy" @click="manualRole = 'guest'">
              Join Session (I Have an Invite)
            </button>
          </template>

          <!-- Negotiation finished — replaces the form so a completed exchange
               can't be resubmitted (that previously caused an InvalidStateError
               from a duplicate setRemoteDescription call). -->
          <template v-else-if="manualState === 'connected'">
            <p class="hint">You're connected. Editing is now synced peer-to-peer.</p>
            <button class="btn-danger" @click="resetManual">Disconnect</button>
          </template>

          <!-- Host flow: create offer, wait for answer -->
          <template v-else-if="manualRole === 'host'">
            <div class="field">
              <label>1. Send this invite to the other device</label>
              <textarea v-model="offerToken" class="token-area" readonly rows="3"></textarea>
              <button class="btn-secondary" :disabled="!offerToken" @click="copy(offerToken)">
                📋 Copy Invite
              </button>
            </div>
            <div class="field">
              <label>2. Paste the answer they send back</label>
              <textarea
                v-model="pastedAnswer"
                class="token-area"
                rows="3"
                placeholder="Paste answer token here"
              ></textarea>
              <button
                class="btn-primary"
                :disabled="manualBusy || !pastedAnswer.trim()"
                @click="connectWithAnswer"
              >
                Connect
              </button>
            </div>
            <button class="btn-danger" @click="resetManual">Cancel</button>
          </template>

          <!-- Guest flow: paste offer, create answer -->
          <template v-else-if="manualRole === 'guest'">
            <div class="field">
              <label>1. Paste the invite you received</label>
              <textarea
                v-model="pastedOffer"
                class="token-area"
                rows="3"
                placeholder="Paste invite token here"
              ></textarea>
              <button
                class="btn-primary"
                :disabled="manualBusy || !pastedOffer.trim() || !!answerToken"
                @click="generateAnswer"
              >
                Generate Answer
              </button>
            </div>
            <div class="field" v-if="answerToken">
              <label>2. Send this answer back to the first device</label>
              <textarea v-model="answerToken" class="token-area" readonly rows="3"></textarea>
              <button class="btn-secondary" @click="copy(answerToken)">📋 Copy Answer</button>
              <p class="hint">Waiting for the other device to connect…</p>
            </div>
            <button class="btn-danger" @click="resetManual">Cancel</button>
          </template>

          <p v-if="manualError" class="error-msg">{{ manualError }}</p>
        </template>

        <!-- ── Online Room (requires signaling server) ─────────────── -->
        <template v-else>
          <p class="hint server-hint">
            <template v-if="isDevelopment">
              Local development requires <code>npm run dev:with-signaling</code>.
            </template>
            <template v-else>
              Share a room link to collaborate through the deployed signaling service.
            </template>
          </p>

          <template v-if="!inRoom">
            <div class="field">
              <label>Room ID</label>
              <div class="input-row">
                <input
                  v-model="roomInput"
                  placeholder="Enter room ID or leave blank"
                  class="text-input"
                  @keydown.enter="join"
                />
                <button class="btn-secondary" @click="roomInput = generateRoomId()">
                  Random
                </button>
              </div>
            </div>

            <div class="field">
              <label>Your name</label>
              <input
                v-model="userName"
                placeholder="Display name"
                class="text-input"
              />
            </div>

            <button class="btn-primary" :disabled="joining" @click="join">
              {{ joining ? 'Connecting…' : 'Join Room' }}
            </button>

            <p v-if="error" class="error-msg">{{ error }}</p>
          </template>

          <template v-else>
            <div class="room-info">
              <span class="room-label">Room ID</span>
              <span class="room-id">{{ currentRoomId }}</span>
              <button class="copy-btn" :class="{ copied }" @click="copyLink">
                {{ copied ? '✓ Copied' : '📋 Copy link' }}
              </button>
            </div>

            <ConnectedUsers />

            <button class="btn-danger" @click="leave">Leave Room</button>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick } from 'vue'
import { Users } from 'lucide-vue-next'
import { useCollaboration } from '~/composables/useCollaboration'
import { useProjectStore } from '~/stores/project'
import { useCollaborationUIStore } from '~/stores/collaborationUI'
import { awareness } from '~~/src/collaboration/Awareness'
import { crdtService } from '~~/src/collaboration/CRDTService'
import type {
  ManualCollaborationSession,
  ManualConnectionState,
} from '~~/src/priority2/collaboration/ManualCollaborationSession'
import ConnectedUsers from './ConnectedUsers.vue'
import PageHeader from '~/components/app-shell/PageHeader.vue'
import { nanoid } from 'nanoid'

type Priority2Window = Window & {
  __COLLAB_PRIORITY2__?: { manualCollaboration: ManualCollaborationSession }
}

const { joinRoom, leaveRoom, webRTCManager } = useCollaboration()
const project = useProjectStore()
const collabUI = useCollaborationUIStore()

const activeTab = ref<'manual' | 'room'>('manual')
const isDevelopment = import.meta.env.DEV

// ── Online Room state ─────────────────────────────────────────────
const roomInput = ref('')
const userName = ref(awareness.localUser.name)
const joining = ref(false)
const error = ref('')
const copied = ref(false)

const inRoom = ref(webRTCManager.isInRoom)
const currentRoomId = ref(webRTCManager.roomId ?? '')

function generateRoomId(): string {
  return nanoid(8).toLowerCase()
}

async function join(): Promise<void> {
  error.value = ''
  const roomId = roomInput.value.trim() || generateRoomId()
  awareness.localUser.name = userName.value || awareness.localUser.name
  joining.value = true
  try {
    await joinRoom(roomId)
    inRoom.value = true
    currentRoomId.value = roomId
    roomInput.value = roomId
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to join room'
  } finally {
    joining.value = false
  }
}

function leave(): void {
  leaveRoom()
  inRoom.value = false
  currentRoomId.value = ''
}

async function copyLink(): Promise<void> {
  const url = `${window.location.origin}${window.location.pathname}#room=${currentRoomId.value}`
  await navigator.clipboard.writeText(url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

// ── Direct Link (backend-free) state ────────────────────────────────────
type ManualRole = 'none' | 'host' | 'guest'

const manualRole = ref<ManualRole>('none')
const manualState = ref<ManualConnectionState>('idle')
const manualBusy = ref(false)
const manualError = ref('')
const offerToken = ref('')
const answerToken = ref('')
const pastedOffer = ref('')
const pastedAnswer = ref('')

let unsubscribeManualState: (() => void) | null = null

const manualStatusLabel = computed(() => {
  switch (manualState.value) {
    case 'connecting': return 'Connecting…'
    case 'connected': return 'Connected'
    case 'failed': return 'Connection failed'
    case 'closed': return 'Closed'
    default: return 'Not connected'
  }
})

function getManual(): ManualCollaborationSession | null {
  return (window as Priority2Window).__COLLAB_PRIORITY2__?.manualCollaboration ?? null
}

/**
 * Ensures a real project is active before collaborating. Previously this
 * only called crdtService.create() directly when uninitialized, which
 * produced a CRDT document that useCollaboration()'s activeProjectId
 * watcher never bound to the scene store via startSceneSync (that watcher
 * only runs when a project is active) — so peers connected successfully
 * but canvas edits never synced. Creating a project first routes through
 * the same watcher the rest of the app already uses, so scene sync is
 * always wired up before collaboration begins.
 */
async function ensureCollabProject(): Promise<void> {
  if (!project.activeProjectId) {
    await project.createProject()
    await nextTick()
  }
  if (!crdtService.isInitialized) {
    crdtService.create(project.activeProjectName || 'Shared Project')
  }
}

function applyRoomHash(): void {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const roomId = params.get('room')?.trim()
  if (!roomId) return
  roomInput.value = roomId
  activeTab.value = 'room'
  collabUI.open()
}

onMounted(() => {
  applyRoomHash()
  window.addEventListener('hashchange', applyRoomHash)

  const manual = getManual()
  if (!manual) return
  manualState.value = manual.connectionState
  unsubscribeManualState = manual.onStateChange((state) => { manualState.value = state })
})

onUnmounted(() => {
  window.removeEventListener('hashchange', applyRoomHash)
  unsubscribeManualState?.()
})

async function startHosting(): Promise<void> {
  manualError.value = ''
  const manual = getManual()
  if (!manual) {
    manualError.value = 'Collaboration engine is not ready yet.'
    return
  }
  manualRole.value = 'host'
  manualBusy.value = true
  try {
    await ensureCollabProject()
    offerToken.value = await manual.createOfferToken()
  } catch (err) {
    manualError.value = err instanceof Error ? err.message : 'Failed to create invite.'
  } finally {
    manualBusy.value = false
  }
}

async function generateAnswer(): Promise<void> {
  manualError.value = ''
  const manual = getManual()
  if (!manual) {
    manualError.value = 'Collaboration engine is not ready yet.'
    return
  }
  if (!pastedOffer.value.trim()) {
    manualError.value = 'Paste the invite token first.'
    return
  }
  manualBusy.value = true
  try {
    await ensureCollabProject()
    answerToken.value = await manual.acceptOfferToken(pastedOffer.value.trim())
  } catch (err) {
    manualError.value = err instanceof Error ? err.message : 'Invalid or expired invite token.'
  } finally {
    manualBusy.value = false
  }
}

async function connectWithAnswer(): Promise<void> {
  manualError.value = ''
  const manual = getManual()
  if (!manual) {
    manualError.value = 'Collaboration engine is not ready yet.'
    return
  }
  if (!pastedAnswer.value.trim()) {
    manualError.value = 'Paste the answer token first.'
    return
  }
  manualBusy.value = true
  try {
    await manual.applyAnswerToken(pastedAnswer.value.trim())
  } catch (err) {
    manualError.value = err instanceof Error ? err.message : 'Invalid or expired answer token.'
  } finally {
    manualBusy.value = false
  }
}

function resetManual(): void {
  getManual()?.close()
  manualRole.value = 'none'
  offerToken.value = ''
  answerToken.value = ''
  pastedOffer.value = ''
  pastedAnswer.value = ''
  manualError.value = ''
}

async function copy(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    // Clipboard API unavailable — token remains selectable in the textarea.
  }
}

defineExpose({ open: () => { collabUI.open() } })
</script>

<style scoped>
.collab-overlay {
  position: absolute; inset: 0; background: var(--app-bg);
  z-index: var(--z-modal); display: flex; flex-direction: column; overflow-y: auto;
}
.collab-panel {
  display: flex; flex-direction: column; flex: 1; min-height: 0;
}
.panel-body {
  max-width: 560px; width: 100%; margin: 0 auto;
  padding: 20px 24px 32px; display: flex; flex-direction: column; gap: 14px;
}
.hint { color: var(--text-secondary); font-size: 13px; margin: 0; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.input-row { display: flex; gap: 8px; }
.text-input {
  flex: 1; background: var(--surface-0); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-primary); font-size: 13px; padding: 7px 10px; outline: none;
  font-family: monospace;
}
.text-input:focus { border-color: var(--accent); }
.btn-primary {
  padding: 8px 16px; background: var(--accent); border: none; border-radius: 6px;
  color: #ffffff; font-size: 13px; cursor: pointer; font-weight: 500;
}
.btn-primary:hover:not(:disabled) { background: var(--accent-strong); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary {
  padding: 7px 12px; background: var(--surface-2); border: 1px solid var(--border);
  border-radius: 6px; color: var(--text-secondary); font-size: 12px; cursor: pointer;
  white-space: nowrap;
}
.btn-secondary:hover { background: var(--hover); }
.btn-danger {
  padding: 8px 16px; background: var(--danger-soft); border: none; border-radius: 6px;
  color: var(--danger); font-size: 13px; cursor: pointer;
}
.btn-danger:hover { filter: brightness(0.9); }
.room-info {
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 8px;
  padding: 12px; display: flex; flex-direction: column; gap: 6px;
}
.room-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.room-id { font-family: monospace; font-size: 16px; color: var(--accent); letter-spacing: 1px; }
.copy-btn {
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 5px;
  color: var(--text-secondary); font-size: 11px; cursor: pointer; padding: 4px 8px;
  align-self: flex-start;
}
.copy-btn.copied { color: var(--success); border-color: var(--success); }
.error-msg { color: var(--danger); font-size: 12px; margin: 0; }
.tab-row {
  display: flex; gap: 2px; padding: 0 24px; border-bottom: 1px solid var(--border);
  max-width: 560px; width: 100%; margin: 0 auto;
}
.tab-btn {
  padding: 10px 12px; background: none; border: none; color: var(--text-muted);
  font-size: 12px; cursor: pointer; border-bottom: 2px solid transparent;
}
.tab-btn.active { color: var(--text-primary); border-bottom-color: var(--accent); }
.tab-btn:hover { color: var(--text-secondary); }
.server-hint { font-size: 11px; }
.server-hint code {
  background: var(--surface-0); border: 1px solid var(--border); border-radius: 4px;
  padding: 1px 5px; color: var(--accent); font-size: 11px;
}
.status-row { display: flex; align-items: center; gap: 8px; }
.status-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted);
  flex-shrink: 0;
}
.status-dot.connecting { background: var(--warning); }
.status-dot.connected { background: var(--success); }
.status-dot.failed { background: var(--danger); }
.status-dot.closed { background: var(--text-muted); }
.status-text { font-size: 12px; color: var(--text-secondary); }
.token-area {
  width: 100%; background: var(--surface-0); border: 1px solid var(--border); border-radius: 6px;
  color: var(--text-primary); font-size: 11px; padding: 8px; outline: none;
  font-family: monospace; resize: vertical; box-sizing: border-box;
}
.token-area:focus { border-color: var(--accent); }
</style>