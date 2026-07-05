import { nanoid } from 'nanoid'
import { computeStats } from '../../version-control/DiffEngine'
import type {
  Branch,
  Commit,
  Repository,
  Snapshot,
} from '../../version-control/types'
import type { SceneObject } from '../../engine/scene-graph/types'
import type { Priority2DatabaseLike } from '../storage/Priority2Database'

export type MergeStrategy = 'ours' | 'theirs'

export interface MergeConflict {
  objectId: string
  ours: SceneObject | null
  theirs: SceneObject | null
  base: SceneObject | null
  resolution: MergeStrategy
}

export interface MergeMetadata {
  commitId: string
  sourceBranchId: string
  targetBranchId: string
  baseCommitId: string | null
  conflicts: MergeConflict[]
  createdAt: number
}

export interface PersistentRepositoryRecord {
  id: string
  repository: Repository
  merges: MergeMetadata[]
  updatedAt: number
}

export interface MergeResult {
  repository: Repository
  commit: Commit
  snapshot: Snapshot
  conflicts: MergeConflict[]
}

export class PersistentVersionControl {
  constructor(private readonly database: Priority2DatabaseLike) {}

  async load(projectId: string): Promise<PersistentRepositoryRecord | null> {
    const record = await this.database.get<PersistentRepositoryRecord>('repositories', projectId)
    return record ? cloneRecord(record) : null
  }

  async save(repository: Repository, merges: MergeMetadata[] = []): Promise<void> {
    await this.database.put<PersistentRepositoryRecord>('repositories', {
      id: repository.projectId,
      repository: clone(repository),
      merges: clone(merges),
      updatedAt: Date.now(),
    })
  }

  async merge(
    repository: Repository,
    sourceBranchId: string,
    targetBranchId: string,
    options: {
      strategy?: MergeStrategy
      author?: string
      message?: string
      priorMerges?: MergeMetadata[]
    } = {},
  ): Promise<MergeResult> {
    const source = findBranch(repository, sourceBranchId)
    const target = findBranch(repository, targetBranchId)
    if (!source || !target) throw new Error('Source or target branch does not exist.')
    if (!source.headCommitId) throw new Error(`Source branch "${source.name}" has no commits.`)

    const strategy = options.strategy ?? 'ours'
    const targetHead = getCommit(repository, target.headCommitId)
    const sourceHead = getCommit(repository, source.headCommitId)
    if (!sourceHead) throw new Error('Source branch head commit is missing.')

    const baseCommitId = findCommonAncestor(repository, targetHead?.id ?? null, sourceHead.id)
    const baseObjects = getSnapshotForCommit(repository, baseCommitId)?.objects ?? []
    const oursObjects = getSnapshotForCommit(repository, targetHead?.id ?? null)?.objects ?? []
    const theirsObjects = getSnapshotForCommit(repository, sourceHead.id)?.objects ?? []

    const merge = mergeSceneObjects(baseObjects, oursObjects, theirsObjects, strategy)
    const snapshot: Snapshot = {
      id: nanoid(),
      objects: clone(merge.objects),
      createdAt: Date.now(),
    }
    const commit: Commit = {
      id: nanoid(),
      message: options.message?.trim() || `Merge ${source.name} into ${target.name}`,
      author: options.author ?? 'You',
      parentId: target.headCommitId,
      branchId: target.id,
      snapshotId: snapshot.id,
      createdAt: Date.now(),
      stats: computeStats(
        targetHead ? getSnapshotForCommit(repository, targetHead.id) : null,
        snapshot,
      ),
    }

    const next = clone(repository)
    next.snapshots.push(snapshot)
    next.commits.push(commit)
    const nextTarget = findBranch(next, target.id)
    if (!nextTarget) throw new Error('Target branch disappeared during merge.')
    nextTarget.headCommitId = commit.id
    next.currentBranchId = target.id
    next.currentCommitId = commit.id

    const metadata: MergeMetadata = {
      commitId: commit.id,
      sourceBranchId: source.id,
      targetBranchId: target.id,
      baseCommitId,
      conflicts: clone(merge.conflicts),
      createdAt: Date.now(),
    }
    await this.save(next, [...(options.priorMerges ?? []), metadata])

    return {
      repository: next,
      commit,
      snapshot,
      conflicts: merge.conflicts,
    }
  }
}

export function mergeSceneObjects(
  base: SceneObject[],
  ours: SceneObject[],
  theirs: SceneObject[],
  strategy: MergeStrategy = 'ours',
): { objects: SceneObject[]; conflicts: MergeConflict[] } {
  const baseMap = toMap(base)
  const oursMap = toMap(ours)
  const theirsMap = toMap(theirs)
  const ids = new Set([...baseMap.keys(), ...oursMap.keys(), ...theirsMap.keys()])
  const result: SceneObject[] = []
  const conflicts: MergeConflict[] = []

  for (const id of ids) {
    const baseObject = baseMap.get(id) ?? null
    const oursObject = oursMap.get(id) ?? null
    const theirsObject = theirsMap.get(id) ?? null

    if (same(oursObject, theirsObject)) {
      if (oursObject) result.push(clone(oursObject))
      continue
    }

    if (same(baseObject, oursObject)) {
      if (theirsObject) result.push(clone(theirsObject))
      continue
    }

    if (same(baseObject, theirsObject)) {
      if (oursObject) result.push(clone(oursObject))
      continue
    }

    const chosen = strategy === 'ours' ? oursObject : theirsObject
    conflicts.push({
      objectId: id,
      ours: oursObject ? clone(oursObject) : null,
      theirs: theirsObject ? clone(theirsObject) : null,
      base: baseObject ? clone(baseObject) : null,
      resolution: strategy,
    })
    if (chosen) result.push(clone(chosen))
  }

  result.sort((left, right) => left.zIndex - right.zIndex)
  return { objects: result, conflicts }
}

export function findCommonAncestor(
  repository: Repository,
  leftCommitId: string | null,
  rightCommitId: string | null,
): string | null {
  const leftAncestors = new Set<string>()
  let current = leftCommitId
  while (current) {
    leftAncestors.add(current)
    current = getCommit(repository, current)?.parentId ?? null
  }

  current = rightCommitId
  while (current) {
    if (leftAncestors.has(current)) return current
    current = getCommit(repository, current)?.parentId ?? null
  }
  return null
}

function getSnapshotForCommit(repository: Repository, commitId: string | null): Snapshot | null {
  if (!commitId) return null
  const commit = getCommit(repository, commitId)
  if (!commit) return null
  return repository.snapshots.find((snapshot) => snapshot.id === commit.snapshotId) ?? null
}

function getCommit(repository: Repository, id: string | null): Commit | null {
  if (!id) return null
  return repository.commits.find((commit) => commit.id === id) ?? null
}

function findBranch(repository: Repository, id: string): Branch | null {
  return repository.branches.find((branch) => branch.id === id) ?? null
}

function toMap(objects: SceneObject[]): Map<string, SceneObject> {
  return new Map(objects.map((object) => [object.id, object]))
}

function same(left: SceneObject | null, right: SceneObject | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function cloneRecord(record: PersistentRepositoryRecord): PersistentRepositoryRecord {
  return clone(record)
}

function clone<T>(value: T): T {
  // structuredClone throws on Vue reactive Proxy-wrapped values — fall back
  // to a JSON round-trip, which reads through Proxies transparently.
  try {
    if (typeof structuredClone === 'function') return structuredClone(value)
  } catch {
    // fall through
  }
  return JSON.parse(JSON.stringify(value)) as T
}
