// tests/unit/fuzzySearch.test.ts
import { describe, it, expect } from 'vitest'
import { fuzzySearch } from '../../src/commands/fuzzySearch'
import type { PaletteCommand } from '../../src/commands/types'

function makeCommand(overrides: Partial<PaletteCommand>): PaletteCommand {
  return {
    id:       overrides.id       ?? 'cmd-test',
    label:    overrides.label    ?? 'Test Command',
    category: overrides.category ?? 'Test',
    handler:  overrides.handler  ?? (() => {}),
    description: overrides.description,
    keywords:    overrides.keywords,
    shortcut:    overrides.shortcut,
  }
}

describe('fuzzySearch', () => {

  describe('empty query', () => {
    it('returns all commands when query is empty', () => {
      const commands = [
        makeCommand({ id: 'a', label: 'Undo', category: 'History' }),
        makeCommand({ id: 'b', label: 'Redo', category: 'History' }),
        makeCommand({ id: 'c', label: 'Export', category: 'Export' }),
      ]
      const results = fuzzySearch('', commands)
      expect(results).toHaveLength(3)
    })

    it('sorts by category then label when query is empty', () => {
      const commands = [
        makeCommand({ id: 'b', label: 'Redo',   category: 'History' }),
        makeCommand({ id: 'a', label: 'Export',  category: 'Export' }),
        makeCommand({ id: 'c', label: 'Undo',   category: 'History' }),
      ]
      const results = fuzzySearch('', commands)
      expect(results[0]?.command.category).toBe('Export')
    })
  })

  describe('exact match', () => {
    it('scores exact label match highest (100)', () => {
      const commands = [
        makeCommand({ id: 'a', label: 'undo' }),
        makeCommand({ id: 'b', label: 'Undo something' }),
      ]
      const results = fuzzySearch('undo', commands)
      expect(results[0]?.command.id).toBe('a')
      expect(results[0]?.score).toBe(100)
    })
  })

  describe('prefix match', () => {
    it('scores label starting with query at 80', () => {
      const cmd = makeCommand({ label: 'Create Rectangle' })
      const results = fuzzySearch('create', [cmd])
      expect(results[0]?.score).toBe(80)
    })
  })

  describe('substring match', () => {
    it('scores label containing query at 60', () => {
      const cmd = makeCommand({ label: 'Open Command Palette' })
      const results = fuzzySearch('palette', [cmd])
      expect(results[0]?.score).toBe(60)
    })
  })

  describe('fuzzy match', () => {
    it('matches characters in order even with gaps', () => {
      const cmd = makeCommand({ label: 'Create Rectangle' })
      const results = fuzzySearch('crect', [cmd])
      expect(results).toHaveLength(1)
      expect(results[0]?.score).toBe(40)
    })

    it('does not match characters out of order', () => {
      const cmd = makeCommand({ label: 'undo', category: 'Other' })
      const results = fuzzySearch('nou', [cmd])
      expect(results).toHaveLength(0)
    })
  })

  describe('keyword match', () => {
    it('finds command by keyword', () => {
      const cmd = makeCommand({
        label: 'Reverse',
        keywords: ['undo', 'back', 'revert'],
      })
      const results = fuzzySearch('undo', [cmd])
      expect(results).toHaveLength(1)
      expect(results[0]?.score).toBe(20)
    })
  })

  describe('category match', () => {
    it('finds command by category', () => {
      const cmd = makeCommand({ label: 'Commit', category: 'Version Control' })
      const results = fuzzySearch('version', [cmd])
      expect(results).toHaveLength(1)
      expect(results[0]?.score).toBe(10)
    })
  })

  describe('no match', () => {
    it('returns empty array when nothing matches', () => {
      const cmd = makeCommand({ label: 'Undo', category: 'History' })
      const results = fuzzySearch('xyzzy', [cmd])
      expect(results).toHaveLength(0)
    })
  })

  describe('ranking', () => {
    it('ranks higher score results first', () => {
      const commands = [
        makeCommand({ id: 'prefix', label: 'undo action', category: 'A' }),
        makeCommand({ id: 'exact',  label: 'undo',        category: 'A' }),
        makeCommand({ id: 'substr', label: 'do undo',     category: 'A' }),
      ]
      const results = fuzzySearch('undo', commands)
      expect(results[0]?.command.id).toBe('exact')
      expect(results[1]?.command.id).toBe('prefix')
      expect(results[2]?.command.id).toBe('substr')
    })
  })
})