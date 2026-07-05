// src/plugins/PluginRegistry.ts
// Module 17 — manages plugin lifecycle

import { createPluginContext } from './PluginContext'
import type {
  PluginDefinition,
  PluginRecord,
  PluginTool,
  PluginCommand,
  PluginPanel,
  PluginExporter,
  PluginShortcut,
} from './types'

export class PluginRegistry {
  private plugins = new Map<string, PluginRecord>()

  /**
   * Why: install creates the plugin record, calls the plugin's install()
   * with a context object, and then immediately activates it. Two-step
   * (install → activate) means we can later support deferred activation.
   */
  async install(definition: PluginDefinition): Promise<void> {
    if (this.plugins.has(definition.id)) {
      console.warn(`[PluginRegistry] Plugin already installed: ${definition.id}`)
      return
    }

    const record: PluginRecord = {
      definition,
      status: 'registered',
      installedAt: Date.now(),
      tools: [],
      commands: [],
      panels: [],
      exporters: [],
      shortcuts: [],
    }

    this.plugins.set(definition.id, record)

    try {
      const context = createPluginContext(definition.id, record)
      await definition.install(context)
      record.status = 'inactive'
      console.log(`[PluginRegistry] Installed: ${definition.name} v${definition.version}`)
      await this.activate(definition.id)
    } catch (err) {
      record.status = 'error'
      record.error = err instanceof Error ? err.message : String(err)
      console.error(`[PluginRegistry] Install failed: ${definition.id}`, err)
    }
  }

  async activate(id: string): Promise<void> {
    const record = this.plugins.get(id)
    if (!record || record.status === 'active') return
    try {
      await record.definition.activate?.()
      record.status = 'active'
      console.log(`[PluginRegistry] Activated: ${id}`)
    } catch (err) {
      record.status = 'error'
      record.error = err instanceof Error ? err.message : String(err)
      console.error(`[PluginRegistry] Activate failed: ${id}`, err)
    }
  }

  async deactivate(id: string): Promise<void> {
    const record = this.plugins.get(id)
    if (!record || record.status !== 'active') return
    try {
      await record.definition.deactivate?.()
      record.status = 'inactive'
      console.log(`[PluginRegistry] Deactivated: ${id}`)
    } catch (err) {
      console.error(`[PluginRegistry] Deactivate failed: ${id}`, err)
    }
  }

  async uninstall(id: string): Promise<void> {
    const record = this.plugins.get(id)
    if (!record) return
    await this.deactivate(id)
    try {
      await record.definition.uninstall?.()
    } catch (err) {
      console.error(`[PluginRegistry] Uninstall failed: ${id}`, err)
    }
    this.plugins.delete(id)
    console.log(`[PluginRegistry] Uninstalled: ${id}`)
  }

  getPlugin(id: string): PluginRecord | undefined {
    return this.plugins.get(id)
  }

  getAllPlugins(): PluginRecord[] {
    return Array.from(this.plugins.values())
  }

  getAllCommands(): PluginCommand[] {
    return this.getAllPlugins().flatMap(p => p.commands)
  }

  getAllTools(): PluginTool[] {
    return this.getAllPlugins().flatMap(p => p.tools)
  }

  getAllPanels(): PluginPanel[] {
    return this.getAllPlugins().flatMap(p => p.panels)
  }

  getAllExporters(): PluginExporter[] {
    return this.getAllPlugins().flatMap(p => p.exporters)
  }

  getAllShortcuts(): PluginShortcut[] {
    return this.getAllPlugins().flatMap(p => p.shortcuts)
  }

  executeCommand(commandId: string): void {
    const cmd = this.getAllCommands().find(c => c.id === commandId)
    if (!cmd) {
      console.warn(`[PluginRegistry] Command not found: ${commandId}`)
      return
    }
    Promise.resolve(cmd.handler()).catch(err =>
      console.error(`[PluginRegistry] Command error: ${commandId}`, err)
    )
  }
}

export const pluginRegistry = new PluginRegistry()