// src/version-control/VersionControlService.ts
// Module 20 — public API for version control operations

import { nanoid } from 'nanoid'
import { SnapshotManager } from './SnapshotManager'
import { computeStats } from './DiffEngine'
import { DEFAULT_BRANCH_NAME } from './types'
import type { Repository, Commit, Branch, DiffResult, Snapshot } from './types'
import type { SceneObject } from '../engine/scene-graph/types'

export class VersionControlService {
  private repo: Repository | null = null
  private snapshots = new SnapshotManager()

  /**
   * Why: initializes a fresh repository for a project. Called when a
   * new project is created or when opening a project with no repo yet.
   * Creates the default 'main' branch with no commits.
   */
  init(projectId: string): void {
    const mainBranch: Branch = {
      id: nanoid(),
      name: DEFAULT_BRANCH_NAME,
      headCommitId: null,
      createdAt: Date.now(),
      parentBranchId: null,
    }

    this.repo = {
      projectId,
      branches: [mainBranch],
      commits: [],
      snapshots: [],
      currentBranchId: mainBranch.id,
      currentCommitId: null,
    }
    this.snapshots.clear()
    console.log(`[VCS] Initialized repository for project: ${projectId}`)
  }

  /**
   * Why: creates a snapshot of current scene state and a commit
   * referencing it. Updates the current branch's head to point at
   * the new commit. Diff stats are precomputed vs. the parent commit
   * so the UI can display them without re-diffing.
   */
  createCommit(objects: SceneObject[], message: string, author = 'You'): Commit | null {
    if (!this.repo) return null

    const branch = this.getCurrentBranch()
    if (!branch) return null

    const snapshot = this.snapshots.create(objects)
    const parentSnap = this.getCurrentSnapshot()
    const stats = computeStats(parentSnap, snapshot)

    const commit: Commit = {
      id: nanoid(),
      message: message.trim() || 'Untitled commit',
      author,
      parentId: branch.headCommitId,
      branchId: branch.id,
      snapshotId: snapshot.id,
      createdAt: Date.now(),
      stats,
    }

    this.repo.commits.push(commit)
    this.repo.snapshots.push(snapshot)
    branch.headCommitId = commit.id
    this.repo.currentCommitId = commit.id

    console.log(`[VCS] Commit ${commit.id.slice(0, 6)} on ${branch.name}: ${commit.message}`)
    return commit
  }

  createBranch(name: string): Branch | null {
    if (!this.repo) return null
    if (this.repo.branches.some(b => b.name === name)) return null

    const current = this.getCurrentBranch()
    const branch: Branch = {
      id: nanoid(),
      name,
      headCommitId: current?.headCommitId ?? null,
      createdAt: Date.now(),
      parentBranchId: current?.id ?? null,
    }
    this.repo.branches.push(branch)
    return branch
  }

  switchBranch(branchId: string): Commit | null {
    if (!this.repo) return null
    const branch = this.repo.branches.find(b => b.id === branchId)
    if (!branch) return null

    this.repo.currentBranchId = branchId
    this.repo.currentCommitId = branch.headCommitId
    console.log(`[VCS] Switched to branch: ${branch.name}`)

    if (branch.headCommitId) {
      return this.repo.commits.find(c => c.id === branch.headCommitId) ?? null
    }
    return null
  }

  restoreCommit(commitId: string): Snapshot | null {
    if (!this.repo) return null
    const commit = this.repo.commits.find(c => c.id === commitId)
    if (!commit) return null

    const snapshot = this.snapshots.get(commit.snapshotId)
    if (!snapshot) return null

    this.repo.currentCommitId = commitId
    console.log(`[VCS] Restored commit ${commit.id.slice(0, 6)}: ${commit.message}`)
    return snapshot
  }

  // ── Getters ──────────────────────────────────────────────────────────

  getRepository(): Repository | null { return this.repo }

  getCurrentBranch(): Branch | null {
    if (!this.repo) return null
    return this.repo.branches.find(b => b.id === this.repo!.currentBranchId) ?? null
  }

  getCurrentSnapshot(): Snapshot | null {
    if (!this.repo?.currentCommitId) return null
    const commit = this.repo.commits.find(c => c.id === this.repo!.currentCommitId)
    if (!commit) return null
    return this.snapshots.get(commit.snapshotId) ?? null
  }

  getCommitHistory(branchId?: string): Commit[] {
  if (!this.repo) return []
  const bid = branchId ?? this.repo.currentBranchId
  const filtered = this.repo.commits.filter(c => c.branchId === bid)
  // Reverse first to get insertion order (newest last → newest first),
  // then stable-sort by createdAt descending as primary key.
  // The reverse() ensures correct order even when createdAt values are
  // identical (e.g. commits created in the same millisecond in tests).
  return filtered
    .reverse()
    .sort((a, b) => b.createdAt - a.createdAt)
}

  getSnapshot(id: string): Snapshot | null {
    return this.snapshots.get(id) ?? null
  }

  hydrate(repo: Repository): void {
    this.repo = repo
    this.snapshots.hydrate(repo.snapshots)
  }
}

export const versionControlService = new VersionControlService()