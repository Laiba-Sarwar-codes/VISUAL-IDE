// app/composables/useHistoryEntries.ts
// UI redesign — reactive read-only view over PersistentHistoryService's
// real entry list (the service that actually drives Cmd+Z; see
// app/plugins/priority2.client.ts and src/ai/AIOperationExecutor.ts for
// the same window.__COLLAB_PRIORITY2__ bridge). Polls on the same order
// of magnitude as the existing monitoring poll (500ms) — no changes to
// PersistentHistoryService's undo/redo logic, this only reads its new
// minimal `historyEntries` projection getter.

import { onMounted, onUnmounted, ref } from 'vue'

export interface HistoryEntryView {
  id: string
  label: string
  createdAt: number
}

interface Priority2HistoryApi {
  getPersistentHistory(): {
    historyEntries: HistoryEntryView[]
    position: number
    size: number
    canUndo: boolean
    canRedo: boolean
  } | null
}

function getService(): ReturnType<Priority2HistoryApi['getPersistentHistory']> {
  if (typeof window === 'undefined') return null
  const api = (window as unknown as { __COLLAB_PRIORITY2__?: Priority2HistoryApi }).__COLLAB_PRIORITY2__
  return api?.getPersistentHistory() ?? null
}

export function useHistoryEntries(pollMs = 500) {
  const entries = ref<HistoryEntryView[]>([])
  const cursor = ref(0)
  const size = ref(0)
  const canUndo = ref(false)
  const canRedo = ref(false)
  const available = ref(false)

  function refresh(): void {
    const service = getService()
    available.value = service !== null
    if (!service) return
    entries.value = service.historyEntries
    cursor.value = service.position
    size.value = service.size
    canUndo.value = service.canUndo
    canRedo.value = service.canRedo
  }

  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    refresh()
    timer = setInterval(refresh, pollMs)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return { entries, cursor, size, canUndo, canRedo, available, refresh }
}
