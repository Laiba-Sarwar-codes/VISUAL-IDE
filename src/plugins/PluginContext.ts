// src/plugins/PluginContext.ts
// Module 17 — creates sandboxed context per plugin

import { useSceneStore } from '../../app/stores/scene'
import { useSelectionStore } from '../../app/stores/selection'
import { useProjectStore } from '../../app/stores/project'
import type { PluginContext, PluginRecord } from './types'

export function createPluginContext(
  pluginId: string,
  record: PluginRecord
): PluginContext {
  return {
    pluginId,

    registerTool(tool) {
      record.tools.push(tool)
      console.log(`[Plugin:${pluginId}] Registered tool: ${tool.id}`)
    },

    registerCommand(command) {
      record.commands.push(command)
      console.log(`[Plugin:${pluginId}] Registered command: ${command.id}`)
    },

    registerPanel(panel) {
      record.panels.push(panel)
      console.log(`[Plugin:${pluginId}] Registered panel: ${panel.id}`)
    },

    registerExporter(exporter) {
      record.exporters.push(exporter)
      console.log(`[Plugin:${pluginId}] Registered exporter: ${exporter.id}`)
    },

    registerShortcut(shortcut) {
      record.shortcuts.push(shortcut)
      console.log(`[Plugin:${pluginId}] Registered shortcut: ${shortcut.keys}`)
    },

    getSceneObjects() {
      return useSceneStore().objects
    },

    getSelectedObjectId() {
      return useSelectionStore().selectedId
    },

    getActiveProjectId() {
      return useProjectStore().activeProjectId
    },

    log(message: string) {
      console.log(`[Plugin:${pluginId}] ${message}`)
    },
  }
}