// app/composables/useVersionControl.ts
// Module 20 — VC lifecycle + command palette integration

import { watch } from 'vue'
import { useVersionControlStore } from '~/stores/versionControl'
import { useProjectStore } from '~/stores/project'
import { commandRegistry } from '~~/src/commands/CommandRegistry'

export function useVersionControl() {
  const vc = useVersionControlStore()
  const project = useProjectStore()

  watch(
    () => project.activeProjectId,
    (id) => {
      if (id) vc.initForProject(id)
    },
    { immediate: true }
  )

  commandRegistry.register({
    id: 'vcs:commit',
    label: 'Version Control: Create Commit',
    category: 'Version Control',
    icon: '💾',
    keywords: ['git', 'commit', 'snapshot', 'save'],
    handler: () => {
      const msg = prompt('Commit message:')
      if (msg?.trim()) vc.createCommit(msg.trim())
    },
  })

  commandRegistry.register({
    id: 'vcs:history',
    label: 'Version Control: View History',
    category: 'Version Control',
    icon: '🌳',
    keywords: ['git', 'history', 'log', 'versions'],
    handler: () => vc.openPanel(),
  })

  commandRegistry.register({
    id: 'vcs:restore-last',
    label: 'Version Control: Restore Last Commit',
    category: 'Version Control',
    icon: '↺',
    keywords: ['git', 'restore', 'revert', 'undo'],
    handler: () => {
      const last = vc.branchCommits[0]
      if (last) vc.restoreCommit(last.id)
    },
  })

  return { vc }
}