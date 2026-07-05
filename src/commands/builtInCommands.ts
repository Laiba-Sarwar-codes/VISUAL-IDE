// src/commands/builtInCommands.ts
// Module 18 — built-in editor commands

import { useEditorStore } from '../../app/stores/editor'
import { useSceneStore } from '../../app/stores/scene'
import { useSelectionStore } from '../../app/stores/selection'
import { useHistoryStore } from '../../app/stores/history'
import { useProjectStore } from '../../app/stores/project'
import type { PaletteCommand } from './types'

export function createBuiltInCommands(): PaletteCommand[] {
  return [
    // ── Scene ──────────────────────────────────────────────────────────
    {
      id: 'scene:create-rectangle',
      label: 'Create Rectangle',
      category: 'Scene',
      icon: '▭',
      keywords: ['rect', 'shape', 'add'],
      handler() {
        useEditorStore().setTool('rectangle')
      },
    },
    {
      id: 'scene:create-ellipse',
      label: 'Create Ellipse',
      category: 'Scene',
      icon: '◯',
      keywords: ['circle', 'oval', 'shape', 'add'],
      handler() {
        useEditorStore().setTool('ellipse')
      },
    },
    {
      id: 'scene:create-text',
      label: 'Create Text',
      category: 'Scene',
      icon: 'T',
      keywords: ['label', 'type', 'add'],
      handler() {
        useEditorStore().setTool('text')
      },
    },
    {
      id: 'scene:delete-selected',
      label: 'Delete Selected Object',
      category: 'Scene',
      icon: '🗑',
      keywords: ['remove', 'delete', 'erase'],
      shortcut: 'Delete',
      handler() {
        useSelectionStore().deleteSelected()
      },
    },

    // ── History ────────────────────────────────────────────────────────
    {
      id: 'history:undo',
      label: 'Undo',
      category: 'History',
      icon: '↩',
      shortcut: 'Cmd+Z',
      handler() {
        useHistoryStore().undo()
      },
    },
    {
      id: 'history:redo',
      label: 'Redo',
      category: 'History',
      icon: '↪',
      shortcut: 'Cmd+Shift+Z',
      handler() {
        useHistoryStore().redo()
      },
    },

    // ── Project ────────────────────────────────────────────────────────
    {
      id: 'project:save',
      label: 'Save Project',
      category: 'Project',
      icon: '💾',
      keywords: ['save', 'persist', 'store'],
      handler() {
        const project = useProjectStore()
        const scene = useSceneStore()
        const editor = useEditorStore()
        project.saveProject(
          scene.objects,
          { x: 0, y: 0, zoom: editor.zoom },
          editor.activeTool
        )
      },
    },
    {
      id: 'project:open-explorer',
      label: 'Open Project Explorer',
      category: 'Project',
      icon: '📁',
      keywords: ['load', 'open', 'project', 'file'],
      handler() {
        useProjectStore().isExplorerOpen = true
      },
    },
    {
      id: 'project:new',
      label: 'New Project',
      category: 'Project',
      icon: '✨',
      keywords: ['new', 'create', 'fresh'],
      handler() {
        const scene = useSceneStore()
        const history = useHistoryStore()
        const project = useProjectStore()
        scene.objects = []
        history.clear()
        project.createProject()
      },
    },

    // ── View ───────────────────────────────────────────────────────────
    {
      id: 'view:toggle-layers',
      label: 'Toggle Layer Panel',
      category: 'View',
      icon: '📋',
      keywords: ['layers', 'panel', 'sidebar', 'hide', 'show'],
      handler() {
        useEditorStore().toggleLeftPanel()
      },
    },
    {
      id: 'view:toggle-inspector',
      label: 'Toggle Inspector Panel',
      category: 'View',
      icon: '🔍',
      keywords: ['inspector', 'properties', 'panel', 'sidebar'],
      handler() {
        useEditorStore().toggleRightPanel()
      },
    },
    {
      id: 'view:zoom-in',
      label: 'Zoom In',
      category: 'View',
      icon: '➕',
      keywords: ['zoom', 'in', 'bigger', 'enlarge'],
      handler() {
        const editor = useEditorStore()
        editor.setZoom(Math.min(editor.zoom * 1.25, 8))
      },
    },
    {
      id: 'view:zoom-out',
      label: 'Zoom Out',
      category: 'View',
      icon: '➖',
      keywords: ['zoom', 'out', 'smaller', 'shrink'],
      handler() {
        const editor = useEditorStore()
        editor.setZoom(Math.max(editor.zoom * 0.8, 0.1))
      },
    },
    {
      id: 'view:reset-zoom',
      label: 'Reset Zoom to 100%',
      category: 'View',
      icon: '⊙',
      keywords: ['zoom', 'reset', '100', 'fit'],
      handler() {
        useEditorStore().setZoom(1)
      },
    },
  ]
}