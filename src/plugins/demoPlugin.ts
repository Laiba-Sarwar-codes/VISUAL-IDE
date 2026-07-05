// src/plugins/demoPlugin.ts
// Module 17 — built-in demo plugin showing full plugin lifecycle

import type { PluginDefinition, PluginContext } from './types'

export const demoPlugin: PluginDefinition = {
  id: 'demo-plugin',
  name: 'Demo Plugin',
  version: '1.0.0',
  description: 'Built-in demo plugin showing the Plugin SDK capabilities.',
  author: 'Collab Visual IDE',

  /**
   * Why: install() is called once by PluginRegistry. The plugin uses
   * the context to register all its capabilities. Nothing runs here
   * that touches the DOM or stores — just registration.
   */
  install(ctx: PluginContext): void {
    // Register a command
    ctx.registerCommand({
      id: 'demo:hello',
      label: 'Demo: Say Hello',
      shortcut: 'Cmd+Shift+H',
      handler() {
        const count = ctx.getSceneObjects().length
        const selected = ctx.getSelectedObjectId()
        ctx.log(`Hello from Demo Plugin! Scene has ${count} objects. Selected: ${selected ?? 'none'}`)
        alert(`[Demo Plugin] Scene objects: ${count}\nSelected: ${selected ?? 'none'}`)
      },
    })

    // Register a tool placeholder
    ctx.registerTool({
      id: 'demo:magic-tool',
      label: 'Magic Tool',
      icon: '✨',
      onActivate() {
        ctx.log('Magic Tool activated')
      },
      onDeactivate() {
        ctx.log('Magic Tool deactivated')
      },
    })

    // Register an exporter placeholder
    ctx.registerExporter({
      id: 'demo:export-txt',
      label: 'Export as Text',
      extension: 'txt',
      async export() {
        const objects = ctx.getSceneObjects()
        const text = objects
          .map(o => `${o.type} "${o.name}" at (${Math.round(o.x)}, ${Math.round(o.y)})`)
          .join('\n')
        const blob = new Blob([text || 'No objects'], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'scene-export.txt'
        a.click()
        URL.revokeObjectURL(url)
        ctx.log('Text export complete')
      },
    })

    // Register a keyboard shortcut
    ctx.registerShortcut({
      keys: 'Cmd+Shift+H',
      commandId: 'demo:hello',
    })

    ctx.log('Demo plugin installed successfully')
  },

  activate() {
    console.log('[DemoPlugin] Activated')
  },

  deactivate() {
    console.log('[DemoPlugin] Deactivated')
  },

  uninstall() {
    console.log('[DemoPlugin] Uninstalled')
  },
}