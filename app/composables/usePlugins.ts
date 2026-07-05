// app/composables/usePlugins.ts
// Module 17 — initializes plugin system and keyboard shortcuts

import { onMounted, onUnmounted } from 'vue'
import { pluginRegistry } from '~~/src/plugins/PluginRegistry'
import { demoPlugin } from '~~/src/plugins/demoPlugin'
import { usePluginStore } from '~/stores/plugins'

export function usePlugins() {
  const pluginStore = usePluginStore()

  /**
   * Why: keyboard shortcut handling is wired here rather than in each
   * plugin so there's one global listener. When a key combo matches
   * a registered shortcut, we look up the linked commandId and execute
   * it via the registry.
   */
  function handleKeyDown(e: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const meta = isMac ? e.metaKey : e.ctrlKey

    const shortcuts = pluginRegistry.getAllShortcuts()

    for (const shortcut of shortcuts) {
      const parts = shortcut.keys.toLowerCase().split('+')
      const needsMeta = parts.includes('cmd') || parts.includes('ctrl')
      const needsShift = parts.includes('shift')
      const needsAlt = parts.includes('alt')
      const key = parts[parts.length - 1]

      if (
        (needsMeta ? meta : !meta) &&
        (needsShift ? e.shiftKey : !e.shiftKey) &&
        (needsAlt ? e.altKey : !e.altKey) &&
        e.key.toLowerCase() === key
      ) {
        e.preventDefault()
        pluginRegistry.executeCommand(shortcut.commandId)
        return
      }
    }
  }

  onMounted(async () => {
    // Install built-in demo plugin
    await pluginStore.install(demoPlugin)
    console.log('[Plugins] Demo plugin installed')

    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return { pluginStore }
}