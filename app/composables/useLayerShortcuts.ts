// app/composables/useLayerShortcuts.ts
// Layer Management — Ctrl/Cmd+G (group), Ctrl/Cmd+Shift+G (ungroup),
// Ctrl/Cmd+A (select all). Mirrors useHistoryShortcuts.ts's guard/mount
// pattern. Ignored while a text input/textarea/contentEditable has focus
// so it never hijacks typing (e.g. renaming a layer, editing text).

import { onMounted, onUnmounted } from 'vue'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'

function isTextInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true
  return (el as HTMLElement).isContentEditable === true
}

export function useLayerShortcuts() {
  const scene = useSceneStore()
  const selection = useSelectionStore()

  function handleKeyDown(e: KeyboardEvent): void {
    if (isTextInputFocused()) return

    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const ctrl = isMac ? e.metaKey : e.ctrlKey
    if (!ctrl) return

    const key = e.key.toLowerCase()

    if (key === 'g' && e.shiftKey) {
      e.preventDefault()
      const groupId = selection.selectedIds.find(id => {
        const obj = scene.objects.find(o => o.id === id)
        return obj?.type === 'group'
      })
      if (groupId) scene.ungroupSelected(groupId)
      return
    }

    if (key === 'g') {
      e.preventDefault()
      if (selection.selectedIds.length >= 2) {
        const groupId = scene.groupSelected(selection.selectedIds)
        if (groupId) selection.select(groupId)
      }
      return
    }

    if (key === 'a') {
      e.preventDefault()
      selection.selectAll()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', handleKeyDown))
}
