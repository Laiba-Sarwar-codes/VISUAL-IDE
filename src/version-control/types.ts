// src/version-control/types.ts
// Module 20 — Local version control type definitions

import type { SceneObject } from '../engine/scene-graph/types'

/**
 * Why: a snapshot is a deep-frozen copy of all scene objects at a
 * moment in time. Every commit stores a snapshot so restore is O(1) —
 * we just copy the snapshot back into the scene store.
 */
export interface Snapshot {
  id: string
  objects: SceneObject[]
  createdAt: number
}

export interface Commit {
  id: string
  message: string
  author: string
  parentId: string | null    // null = root commit
  branchId: string
  snapshotId: string          // references Snapshot.id
  createdAt: number

  // Diff stats vs parent — precomputed for cheap display
  stats: CommitStats
}

export interface CommitStats {
  added: number
  removed: number
  modified: number
}

export interface Branch {
  id: string
  name: string
  headCommitId: string | null   // null = empty branch
  createdAt: number
  parentBranchId: string | null
}

export interface Repository {
  projectId: string
  branches: Branch[]
  commits: Commit[]
  snapshots: Snapshot[]
  currentBranchId: string
  currentCommitId: string | null
}

/**
 * Why: DiffResult categorizes changes between two snapshots for display
 * in the diff view. Keeping added/removed/modified as separate arrays
 * (not a flat change log) makes rendering cleaner.
 */
export interface DiffResult {
  added: SceneObject[]
  removed: SceneObject[]
  modified: Array<{
    before: SceneObject
    after: SceneObject
    changedFields: string[]
  }>
  unchanged: number
}

export const DEFAULT_BRANCH_NAME = 'main'