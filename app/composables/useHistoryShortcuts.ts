// app/composables/useHistoryShortcuts.ts
// Module 8 — keyboard shortcuts for undo/redo

import { onMounted, onUnmounted } from 'vue'
import { useHistoryStore } from '~/stores/history'

export function useHistoryShortcuts() {
  const history = useHistoryStore()

  function handleKeyDown(e: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const ctrl = isMac ? e.metaKey : e.ctrlKey

    if (!ctrl) return

    if (e.shiftKey && e.key === 'z') {
      e.preventDefault()
      history.redo()
      return
    }

    if (!e.shiftKey && e.key === 'z') {
      e.preventDefault()
      history.undo()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
}