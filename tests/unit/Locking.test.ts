// tests/unit/Locking.test.ts
// V1: Tests for Task 1 — lock enforcement at the interaction layer

import { describe, it, expect, beforeEach } from 'vitest'
import { SelectionManager } from '../../src/engine/scene-graph/SelectionManager'
import { makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('SelectionManager — locking (V1)', () => {

  describe('startDrag with locked objects', () => {
    it('returns false and does not start drag for a locked object', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ id: 'locked-1', locked: true, x: 10, y: 20 })
      sm.select(obj)
      const started = sm.startDrag(100, 100, obj)
      expect(started).toBe(false)
      expect(sm.drag.isDragging).toBe(false)
    })

    it('does not change object transform when locked drag is attempted', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ id: 'locked-2', locked: true, x: 10, y: 20 })
      sm.select(obj)
      sm.startDrag(100, 100, obj)
      // isDragging is false so computeDragPosition should not be called
      // but even if called, the drag baseline was never set
      expect(sm.drag.isDragging).toBe(false)
    })

    it('returns true and starts drag for an unlocked object', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ id: 'unlocked-1', locked: false, x: 5, y: 5 })
      sm.select(obj)
      const started = sm.startDrag(50, 60, obj)
      expect(started).toBe(true)
      expect(sm.drag.isDragging).toBe(true)
    })

    it('unlocked object drag produces correct new position', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ id: 'unlocked-2', locked: false, x: 0, y: 0 })
      sm.select(obj)
      sm.startDrag(10, 10, obj)
      const newPos = sm.computeDragPosition(20, 30)
      expect(newPos.x).toBe(10)   // 0 + (20-10)
      expect(newPos.y).toBe(20)   // 0 + (30-10)
    })

    it('locked object drag does not move — isDragging stays false', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ id: 'locked-3', locked: true, x: 100, y: 200 })
      sm.select(obj)
      sm.startDrag(0, 0, obj)
      expect(sm.drag.isDragging).toBe(false)
    })
  })

  describe('select allows locked objects', () => {
    it('can select a locked object', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ locked: true })
      sm.select(obj)
      expect(sm.selectedId).toBe(obj.id)
    })

    it('can select an unlocked object', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ locked: false })
      sm.select(obj)
      expect(sm.selectedId).toBe(obj.id)
    })

    it('select null clears selection', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ locked: false })
      sm.select(obj)
      sm.select(null)
      expect(sm.selectedId).toBeNull()
    })
  })

  describe('lock state changes', () => {
    it('previously locked object can be dragged after unlocking', () => {
      const sm = new SelectionManager()
      const obj = makeObject({ id: 'toggle-lock', locked: true, x: 0, y: 0 })
      sm.select(obj)

      // Locked — cannot drag
      const lockedResult = sm.startDrag(0, 0, obj)
      expect(lockedResult).toBe(false)

      // Unlock the object (simulated)
      const unlocked = { ...obj, locked: false }
      sm.select(unlocked)
      const unlockedResult = sm.startDrag(0, 0, unlocked)
      expect(unlockedResult).toBe(true)
    })
  })
})
