// tests/integration/VersionControl.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { VersionControlService } from '../../src/version-control/VersionControlService'
import { makeObject, makeObjects, resetIdCounter } from '../unit/helpers'

beforeEach(() => resetIdCounter())

describe('VersionControlService — integration', () => {
  let vcs: VersionControlService

  beforeEach(() => {
    vcs = new VersionControlService()
    vcs.init('project-1')
  })

  // ── Init ─────────────────────────────────────────────────────────────

  describe('init', () => {
    it('creates a repository with a main branch', () => {
      const repo = vcs.getRepository()
      expect(repo).not.toBeNull()
      expect(repo?.branches).toHaveLength(1)
      expect(repo?.branches[0]?.name).toBe('main')
    })

    it('starts with no commits', () => {
      expect(vcs.getCommitHistory()).toHaveLength(0)
    })

    it('starts with no current commit', () => {
      expect(vcs.getRepository()?.currentCommitId).toBeNull()
    })

    it('current branch is main', () => {
      expect(vcs.getCurrentBranch()?.name).toBe('main')
    })
  })

  // ── Commit ────────────────────────────────────────────────────────────

  describe('createCommit', () => {
    it('creates a commit with the given message', () => {
      const objects = makeObjects(2)
      const commit = vcs.createCommit(objects, 'Initial state')
      expect(commit).not.toBeNull()
      expect(commit?.message).toBe('Initial state')
    })

    it('defaults message to "Untitled commit" when empty', () => {
      const commit = vcs.createCommit([], '')
      expect(commit?.message).toBe('Untitled commit')
    })

    it('increments commit history', () => {
      vcs.createCommit(makeObjects(1), 'first')
      vcs.createCommit(makeObjects(2), 'second')
      expect(vcs.getCommitHistory()).toHaveLength(2)
    })

    it('updates branch head to latest commit', () => {
      const commit = vcs.createCommit(makeObjects(1), 'test')
      expect(vcs.getCurrentBranch()?.headCommitId).toBe(commit?.id)
    })

    it('computes correct diff stats vs parent', () => {
      const objects = makeObjects(3)
      vcs.createCommit(objects, 'first')
      const second = vcs.createCommit([...objects, makeObject()], 'second')
      expect(second?.stats.added).toBe(1)
      expect(second?.stats.removed).toBe(0)
    })

    it('first commit stats show all objects as added', () => {
      const commit = vcs.createCommit(makeObjects(3), 'first')
      expect(commit?.stats.added).toBe(3)
    })

    it('returns null when no repo initialized', () => {
      const fresh = new VersionControlService()
      const commit = fresh.createCommit([], 'test')
      expect(commit).toBeNull()
    })
  })

  // ── Snapshot restoration ──────────────────────────────────────────────

  describe('restoreCommit', () => {
    it('returns the snapshot for the given commit', () => {
      const objects = makeObjects(2)
      const commit = vcs.createCommit(objects, 'v1')!
      const snapshot = vcs.restoreCommit(commit.id)
      expect(snapshot).not.toBeNull()
      expect(snapshot?.objects).toHaveLength(2)
    })

    it('snapshot objects match what was committed', () => {
      const obj = makeObject({ id: 'fixed-id', fill: '#ff0000' })
      const commit = vcs.createCommit([obj], 'with red object')!
      const snapshot = vcs.restoreCommit(commit.id)
      expect(snapshot?.objects[0]?.fill).toBe('#ff0000')
    })

    it('returns null for unknown commit id', () => {
      expect(vcs.restoreCommit('nonexistent')).toBeNull()
    })

    it('updates currentCommitId on restore', () => {
      const c1 = vcs.createCommit(makeObjects(1), 'v1')!
      vcs.createCommit(makeObjects(2), 'v2')
      vcs.restoreCommit(c1.id)
      expect(vcs.getRepository()?.currentCommitId).toBe(c1.id)
    })
  })

  // ── Branches ──────────────────────────────────────────────────────────

  describe('createBranch', () => {
    it('creates a new branch', () => {
      const branch = vcs.createBranch('feature')
      expect(branch).not.toBeNull()
      expect(branch?.name).toBe('feature')
    })

    it('new branch starts at current head commit', () => {
      const commit = vcs.createCommit(makeObjects(1), 'v1')!
      const branch = vcs.createBranch('feature')
      expect(branch?.headCommitId).toBe(commit.id)
    })

    it('returns null when branch name already exists', () => {
      vcs.createBranch('feature')
      expect(vcs.createBranch('feature')).toBeNull()
    })

    it('does not duplicate the main branch', () => {
      vcs.createBranch('main')
      const repo = vcs.getRepository()
      const mainBranches = repo?.branches.filter(b => b.name === 'main')
      expect(mainBranches).toHaveLength(1)
    })
  })

  describe('switchBranch', () => {
    it('switches to an existing branch', () => {
      const branch = vcs.createBranch('feature')!
      vcs.switchBranch(branch.id)
      expect(vcs.getCurrentBranch()?.name).toBe('feature')
    })

    it('returns null when switching to empty branch', () => {
      const branch = vcs.createBranch('empty')!
      const result = vcs.switchBranch(branch.id)
      expect(result).toBeNull()
    })

    it('returns head commit when switching to branch with commits', () => {
      const commit = vcs.createCommit(makeObjects(1), 'v1')!
      const branch = vcs.createBranch('copy')!
      vcs.switchBranch(branch.id)
      const result = vcs.switchBranch(
        vcs.getRepository()!.branches.find(b => b.name === 'main')!.id
      )
      expect(result?.id).toBe(commit.id)
    })
  })

  // ── Commit history ────────────────────────────────────────────────────

  describe('getCommitHistory', () => {
    it('returns commits in reverse chronological order', () => {
      vcs.createCommit(makeObjects(1), 'first')
      vcs.createCommit(makeObjects(2), 'second')
      vcs.createCommit(makeObjects(3), 'third')
      const history = vcs.getCommitHistory()
      expect(history[0]?.message).toBe('third')
      expect(history[2]?.message).toBe('first')
    })

    it('only returns commits for the current branch', () => {
      vcs.createCommit(makeObjects(1), 'main-commit')
      const branch = vcs.createBranch('other')!
      vcs.switchBranch(branch.id)
      vcs.createCommit(makeObjects(2), 'branch-commit')
      const history = vcs.getCommitHistory()
      expect(history).toHaveLength(1)
      expect(history[0]?.message).toBe('branch-commit')
    })
  })
})