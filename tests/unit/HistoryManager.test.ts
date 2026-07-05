// tests/unit/HistoryManager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { HistoryManager } from '../../src/engine/history/HistoryManager'
import type { HistoryOperation } from '../../src/engine/history/types'

function makeOp(label: string, applyFn?: () => void, revertFn?: () => void): HistoryOperation {
  return {
    id: `op-${label}`,
    type: 'object:create',
    timestamp: Date.now(),
    label,
    before: null,
    after: null,
    apply:  applyFn  ?? vi.fn(),
    revert: revertFn ?? vi.fn(),
  }
}

describe('HistoryManager', () => {
  let manager: HistoryManager

  beforeEach(() => {
    manager = new HistoryManager()
  })

  // ── Record ─────────────────────────────────────────────────────────

  describe('record', () => {
    it('starts with empty stacks', () => {
      expect(manager.canUndo).toBe(false)
      expect(manager.canRedo).toBe(false)
      expect(manager.stackSize).toBe(0)
    })

    it('adds operation to undo stack', () => {
      manager.record(makeOp('create'))
      expect(manager.canUndo).toBe(true)
      expect(manager.stackSize).toBe(1)
    })

    it('clears redo stack on new record', () => {
      manager.record(makeOp('A'))
      manager.undo()
      expect(manager.canRedo).toBe(true)
      manager.record(makeOp('B'))
      expect(manager.canRedo).toBe(false)
    })

    it('calls onRecord callback', () => {
      const cb = vi.fn()
      manager.setOnRecord(cb)
      manager.record(makeOp('test'))
      expect(cb).toHaveBeenCalledOnce()
    })

    it('respects MAX_HISTORY limit of 100', () => {
      for (let i = 0; i < 110; i++) {
        manager.record(makeOp(`op-${i}`))
      }
      expect(manager.stackSize).toBeLessThanOrEqual(100)
    })
  })

  // ── Undo ───────────────────────────────────────────────────────────

  describe('undo', () => {
    it('returns null when stack is empty', () => {
      expect(manager.undo()).toBeNull()
    })

    it('calls revert on the operation', () => {
      const revert = vi.fn()
      manager.record(makeOp('move', undefined, revert))
      manager.undo()
      expect(revert).toHaveBeenCalledOnce()
    })

    it('returns the operation label', () => {
      manager.record(makeOp('Delete Object'))
      expect(manager.undo()).toBe('Delete Object')
    })

    it('moves operation to redo stack', () => {
      manager.record(makeOp('A'))
      manager.undo()
      expect(manager.canUndo).toBe(false)
      expect(manager.canRedo).toBe(true)
    })

    it('exposes undoLabel before undo', () => {
      manager.record(makeOp('Create Rect'))
      expect(manager.undoLabel).toBe('Create Rect')
    })
  })

  // ── Redo ───────────────────────────────────────────────────────────

  describe('redo', () => {
    it('returns null when redo stack is empty', () => {
      expect(manager.redo()).toBeNull()
    })

    it('calls apply on the operation', () => {
      const apply = vi.fn()
      manager.record(makeOp('create', apply))
      manager.undo()
      manager.redo()
      expect(apply).toHaveBeenCalledOnce()
    })

    it('returns the operation label', () => {
      manager.record(makeOp('Move'))
      manager.undo()
      expect(manager.redo()).toBe('Move')
    })

    it('moves operation back to undo stack', () => {
      manager.record(makeOp('A'))
      manager.undo()
      manager.redo()
      expect(manager.canUndo).toBe(true)
      expect(manager.canRedo).toBe(false)
    })
  })

  // ── Clear ──────────────────────────────────────────────────────────

  describe('clear', () => {
    it('empties both stacks', () => {
      manager.record(makeOp('A'))
      manager.record(makeOp('B'))
      manager.undo()
      manager.clear()
      expect(manager.canUndo).toBe(false)
      expect(manager.canRedo).toBe(false)
      expect(manager.stackSize).toBe(0)
    })
  })
})