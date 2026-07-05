// src/plugins/types.ts
// Module 17 — Plugin SDK type definitions

export type PluginStatus = 'registered' | 'active' | 'inactive' | 'error'

// ── What a plugin can register ─────────────────────────────────────────

export interface PluginTool {
  id: string
  label: string
  icon: string
  cursor?: string
  onActivate?: () => void
  onDeactivate?: () => void
}

export interface PluginCommand {
  id: string
  label: string
  shortcut?: string
  handler: () => void | Promise<void>
}

export interface PluginPanel {
  id: string
  label: string
  position: 'left' | 'right' | 'bottom'
  component: unknown
}

export interface PluginExporter {
  id: string
  label: string
  extension: string
  export: () => Promise<void>
}

export interface PluginShortcut {
  keys: string
  commandId: string
}

// ── Context API — what plugins receive ────────────────────────────────

export interface PluginContext {
  pluginId: string

  registerTool(tool: PluginTool): void
  registerCommand(command: PluginCommand): void
  registerPanel(panel: PluginPanel): void
  registerExporter(exporter: PluginExporter): void
  registerShortcut(shortcut: PluginShortcut): void

  // Fixed: synchronous return types to match PluginContext.ts implementation
  getSceneObjects(): import('../engine/scene-graph/types').SceneObject[]
  getSelectedObjectId(): string | null
  getActiveProjectId(): string | null

  log(message: string): void
}

// ── Plugin definition — what every plugin must export ─────────────────

export interface PluginDefinition {
  id: string
  name: string
  version: string
  description: string
  author?: string

  install(context: PluginContext): void | Promise<void>
  activate?(): void | Promise<void>
  deactivate?(): void | Promise<void>
  uninstall?(): void | Promise<void>
}

// ── Registry record — internal state per plugin ───────────────────────

export interface PluginRecord {
  definition: PluginDefinition
  status: PluginStatus
  installedAt: number
  error?: string
  tools: PluginTool[]
  commands: PluginCommand[]
  panels: PluginPanel[]
  exporters: PluginExporter[]
  shortcuts: PluginShortcut[]
}