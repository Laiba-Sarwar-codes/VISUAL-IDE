// app/stores/versionControl.ts
// Module 20 — reactive version control state

import { defineStore } from 'pinia'
import { versionControlService } from '~~/src/version-control/VersionControlService'
import { computeDiff } from '~~/src/version-control/DiffEngine'
import { normalizeHierarchy } from '~~/src/layers/layerMigration'
import { useSceneStore } from './scene'
import { useProjectStore } from './project'
import type { Branch, Commit, DiffResult } from '~~/src/version-control/types'

interface VCState {
  isPanelOpen: boolean
  branches: Branch[]
  commits: Commit[]
  currentBranchId: string | null
  currentCommitId: string | null
  compareCommitId: string | null   // for diff view
  lastCommitMessage: string
}

export const useVersionControlStore = defineStore('versionControl', {
  state: (): VCState => ({
    isPanelOpen: false,
    branches: [],
    commits: [],
    currentBranchId: null,
    currentCommitId: null,
    compareCommitId: null,
    lastCommitMessage: '',
  }),

  getters: {
    currentBranch: (state): Branch | null =>
      state.branches.find(b => b.id === state.currentBranchId) ?? null,

    currentCommit: (state): Commit | null =>
      state.commits.find(c => c.id === state.currentCommitId) ?? null,

    branchCommits: (state): Commit[] =>
      state.commits
        .filter(c => c.branchId === state.currentBranchId)
        .sort((a, b) => b.createdAt - a.createdAt),

    hasCommits: (state): boolean => state.commits.length > 0,
  },

  actions: {
    /**
     * Why: called when a project is opened or created. Ensures every
     * project has its own repository, and rebuilds the reactive state
     * from the service singleton.
     */
    initForProject(projectId: string): void {
      const existing = versionControlService.getRepository()
      if (!existing || existing.projectId !== projectId) {
        versionControlService.init(projectId)
      }
      this.sync()
    },

    /**
     * Why: syncs Pinia state from the service after every mutation.
     * Called after create/restore/switch so all UI components update.
     */
    sync(): void {
      const repo = versionControlService.getRepository()
      if (!repo) return
      this.branches = [...repo.branches]
      this.commits = [...repo.commits]
      this.currentBranchId = repo.currentBranchId
      this.currentCommitId = repo.currentCommitId
    },

    /**
     * Why: single entry point for creating commits from anywhere in
     * the app (panel button, command palette, keyboard shortcut).
     * Reads current scene, creates commit, syncs reactive state.
     */
    createCommit(message: string): Commit | null {
      const scene = useSceneStore()
      const commit = versionControlService.createCommit(scene.objects, message)
      if (commit) {
        this.lastCommitMessage = message
        this.sync()
      }
      return commit
    },

    /**
     * Why: restoring rewrites the scene store's objects array from the
     * snapshot. We use _setAllRaw to bypass history recording — the
     * restore itself is a version-control operation, not an undoable edit.
     * normalizeHierarchy guards against dangling parentIds if the commit
     * predates the layer hierarchy feature or was corrupted in storage.
     */
    restoreCommit(commitId: string): boolean {
      const snapshot = versionControlService.restoreCommit(commitId)
      if (!snapshot) return false
      const scene = useSceneStore()
      scene._setAllRaw(normalizeHierarchy(JSON.parse(JSON.stringify(snapshot.objects))))
      this.sync()
      return true
    },

    createBranch(name: string): boolean {
      const branch = versionControlService.createBranch(name)
      if (branch) this.sync()
      return branch !== null
    },

    switchBranch(branchId: string): void {
      const commit = versionControlService.switchBranch(branchId)
      if (commit) {
        this.restoreCommit(commit.id)
      } else {
        this.sync()
      }
    },

    openPanel(): void { this.isPanelOpen = true }
    ,
    closePanel(): void { this.isPanelOpen = false }
    ,

    /**
     * Why: computes diff between the current commit and any other commit
     * for the diff view. Returns null if either snapshot is missing.
     */
    getDiff(fromCommitId: string, toCommitId: string): DiffResult | null {
      const fromCommit = this.commits.find(c => c.id === fromCommitId)
      const toCommit = this.commits.find(c => c.id === toCommitId)
      if (!fromCommit || !toCommit) return null
      const fromSnap = versionControlService.getSnapshot(fromCommit.snapshotId)
      const toSnap = versionControlService.getSnapshot(toCommit.snapshotId)
      if (!fromSnap || !toSnap) return null
      return computeDiff(fromSnap, toSnap)
    },
  },
})