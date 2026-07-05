// app/composables/useCommandPalette.ts
// Module 18 — initializes commands and keyboard shortcut

import { onMounted, onUnmounted } from 'vue'
import { commandRegistry } from '~~/src/commands/CommandRegistry'
import { createBuiltInCommands } from '~~/src/commands/builtInCommands'
import { createLayerCommands } from '~~/src/commands/layerCommands'
import { createAICommands } from '~~/src/commands/aiCommands'
import { pluginRegistry } from '~~/src/plugins/PluginRegistry'
import { useCommandPaletteStore } from '~/stores/commandPalette'

export function useCommandPalette() {
  const palette = useCommandPaletteStore()

  function handleKeyDown(e: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const meta = isMac ? e.metaKey : e.ctrlKey

    if (meta && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      palette.toggle()
    }
  }

  onMounted(() => {
    commandRegistry.registerMany(createBuiltInCommands())
    commandRegistry.registerMany(createLayerCommands())
    commandRegistry.registerMany(createAICommands())

    const pluginCommands = pluginRegistry.getAllCommands()
    for (const cmd of pluginCommands) {
      commandRegistry.register({
        id: `plugin:${cmd.id}`,
        label: cmd.label,
        category: 'Plugin',
        icon: '🧩',
        shortcut: cmd.shortcut,
        handler: cmd.handler,
      })
    }

    console.log(`[CommandPalette] Registered ${commandRegistry.size} commands`)
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return { palette }
}