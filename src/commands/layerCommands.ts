// src/commands/layerCommands.ts
// Layer Management — command palette entries for folder/group/align/
// distribute actions. Follows the exact literal-array pattern in
// builtInCommands.ts so it registers through the same CommandRegistry.

import { useSceneStore } from '../../app/stores/scene'
import { useSelectionStore } from '../../app/stores/selection'
import type { PaletteCommand } from './types'

export function createLayerCommands(): PaletteCommand[] {
  return [
    {
      id: 'layer:create-folder',
      label: 'Create Folder',
      category: 'Layers',
      icon: '📁',
      keywords: ['folder', 'group', 'organize'],
      handler() {
        useSceneStore().createFolder('New Folder')
      },
    },
    {
      id: 'layer:group-selection',
      label: 'Group Selection',
      category: 'Layers',
      icon: '⧉',
      keywords: ['group', 'combine'],
      shortcut: 'Cmd+G',
      handler() {
        const scene = useSceneStore()
        const selection = useSelectionStore()
        if (selection.selectedIds.length < 2) return
        const groupId = scene.groupSelected(selection.selectedIds)
        if (groupId) selection.select(groupId)
      },
    },
    {
      id: 'layer:ungroup-selection',
      label: 'Ungroup Selection',
      category: 'Layers',
      icon: '⧉⃠',
      keywords: ['ungroup', 'split'],
      shortcut: 'Cmd+Shift+G',
      handler() {
        const scene = useSceneStore()
        const selection = useSelectionStore()
        const groupId = selection.selectedIds.find(id => scene.objects.find(o => o.id === id)?.type === 'group')
        if (groupId) scene.ungroupSelected(groupId)
      },
    },

    // ── Align ──────────────────────────────────────────────────────────
    ...(['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'] as const).map((edge): PaletteCommand => ({
      id: `align:${edge}`,
      label: `Align ${alignLabel(edge)}`,
      category: 'Align',
      icon: '⇤',
      keywords: ['align', edge],
      handler() {
        const scene = useSceneStore()
        const selection = useSelectionStore()
        if (selection.selectedIds.length < 2) return
        scene.alignSelected(selection.selectedIds, edge)
      },
    })),

    // ── Distribute ─────────────────────────────────────────────────────
    {
      id: 'distribute:horizontal',
      label: 'Distribute Horizontally',
      category: 'Align',
      icon: '⇔',
      keywords: ['distribute', 'spacing', 'horizontal'],
      handler() {
        const scene = useSceneStore()
        const selection = useSelectionStore()
        if (selection.selectedIds.length < 3) return
        scene.distributeSelected(selection.selectedIds, 'horizontal')
      },
    },
    {
      id: 'distribute:vertical',
      label: 'Distribute Vertically',
      category: 'Align',
      icon: '⇕',
      keywords: ['distribute', 'spacing', 'vertical'],
      handler() {
        const scene = useSceneStore()
        const selection = useSelectionStore()
        if (selection.selectedIds.length < 3) return
        scene.distributeSelected(selection.selectedIds, 'vertical')
      },
    },
  ]
}

function alignLabel(edge: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'): string {
  switch (edge) {
    case 'left': return 'Left'
    case 'hcenter': return 'Center'
    case 'right': return 'Right'
    case 'top': return 'Top'
    case 'vcenter': return 'Middle'
    case 'bottom': return 'Bottom'
  }
}
