import { describe, expect, it } from 'vitest'
import { findCommonAncestor, mergeSceneObjects } from '../../src/priority2/version-control/PersistentVersionControl'
import type { Repository } from '../../src/version-control/types'
import type { SceneObject } from '../../src/engine/scene-graph/types'

function object(id: string, x: number): SceneObject {
  return {
    id, name: id, type: 'rectangle', x, y: 0, width: 10, height: 10,
    rotation: 0, visible: true, locked: false, opacity: 1,
    fill: '#fff', stroke: '#000', zIndex: 0,
  }
}

describe('Priority 2 merge engine', () => {
  it('accepts a change made only on theirs', () => {
    const base = [object('a', 0)]
    const ours = [object('a', 0)]
    const theirs = [object('a', 10)]
    const result = mergeSceneObjects(base, ours, theirs)
    expect(result.objects[0]?.x).toBe(10)
    expect(result.conflicts).toHaveLength(0)
  })

  it('accepts independent object changes from both sides', () => {
    const base = [object('a', 0), object('b', 0)]
    const ours = [object('a', 10), object('b', 0)]
    const theirs = [object('a', 0), object('b', 20)]
    const result = mergeSceneObjects(base, ours, theirs)
    expect(result.objects.find((item) => item.id === 'a')?.x).toBe(10)
    expect(result.objects.find((item) => item.id === 'b')?.x).toBe(20)
    expect(result.conflicts).toHaveLength(0)
  })

  it('detects and resolves a conflict using ours', () => {
    const result = mergeSceneObjects([object('a', 0)], [object('a', 10)], [object('a', 20)], 'ours')
    expect(result.objects[0]?.x).toBe(10)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.resolution).toBe('ours')
  })

  it('finds the nearest common ancestor', () => {
    const repository: Repository = {
      projectId: 'p', branches: [], snapshots: [], currentBranchId: '', currentCommitId: null,
      commits: [
        { id: 'root', message: '', author: '', parentId: null, branchId: 'main', snapshotId: '', createdAt: 0, stats: { added: 0, removed: 0, modified: 0 } },
        { id: 'left', message: '', author: '', parentId: 'root', branchId: 'main', snapshotId: '', createdAt: 1, stats: { added: 0, removed: 0, modified: 0 } },
        { id: 'right', message: '', author: '', parentId: 'root', branchId: 'feature', snapshotId: '', createdAt: 2, stats: { added: 0, removed: 0, modified: 0 } },
      ],
    }
    expect(findCommonAncestor(repository, 'left', 'right')).toBe('root')
  })
})
