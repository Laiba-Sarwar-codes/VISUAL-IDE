// tests/unit/SelectionMultiSelect.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSceneStore } from '~/stores/scene'
import { useSelectionStore } from '~/stores/selection'

beforeEach(() => {
  setActivePinia(createPinia())
})

function seedObjects(count: number): string[] {
  const scene = useSceneStore()
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const obj = scene.addObject({ type: 'rectangle', x: i * 10, y: 0 })
    ids.push(obj.id)
  }
  return ids
}

describe('selection store — back-compat single-select', () => {
  it('select(id) sets both selectedId and selectedIds', () => {
    const [a] = seedObjects(1)
    const selection = useSelectionStore()
    selection.select(a!)
    expect(selection.selectedId).toBe(a)
    expect(selection.selectedIds).toEqual([a])
  })

  it('select(null) / clear() empty both', () => {
    const [a] = seedObjects(1)
    const selection = useSelectionStore()
    selection.select(a!)
    selection.clear()
    expect(selection.selectedId).toBeNull()
    expect(selection.selectedIds).toEqual([])
  })

  it('selectedObject getter resolves the primary selection', () => {
    const [a] = seedObjects(1)
    const selection = useSelectionStore()
    selection.select(a!)
    expect(selection.selectedObject?.id).toBe(a)
  })

  it('deleteSelected on a single selection behaves exactly as before', () => {
    const [a, b] = seedObjects(2)
    const scene = useSceneStore()
    const selection = useSelectionStore()
    selection.select(a!)
    selection.deleteSelected()
    expect(scene.objects.find(o => o.id === a)).toBeUndefined()
    expect(scene.objects.find(o => o.id === b)).toBeDefined()
    expect(selection.selectedId).toBeNull()
  })
})

describe('selection store — multi-select', () => {
  it('toggleSelect adds and removes ids, tracking the last-toggled-in as primary', () => {
    const [a, b] = seedObjects(2)
    const selection = useSelectionStore()
    selection.toggleSelect(a!)
    selection.toggleSelect(b!)
    expect(selection.selectedIds.sort()).toEqual([a, b].sort())
    expect(selection.selectedId).toBe(b)

    selection.toggleSelect(b!) // toggle back out
    expect(selection.selectedIds).toEqual([a])
    expect(selection.selectedId).toBe(a)
  })

  it('selectRange replaces the selection with an ordered id list', () => {
    const [a, b, c] = seedObjects(3)
    const selection = useSelectionStore()
    selection.selectRange([a!, b!, c!])
    expect(selection.selectedIds).toEqual([a, b, c])
    expect(selection.selectedId).toBe(c)
  })

  it('selectAll selects only visible, unlocked, non-folder objects', () => {
    const scene = useSceneStore()
    const selection = useSelectionStore()
    const visible = scene.addObject({ type: 'rectangle' })
    const hidden = scene.addObject({ type: 'rectangle' })
    scene.toggleVisibility(hidden.id)
    const locked = scene.addObject({ type: 'rectangle' })
    scene.toggleLocked(locked.id)

    selection.selectAll()
    expect(selection.selectedIds).toContain(visible.id)
    expect(selection.selectedIds).not.toContain(hidden.id)
    expect(selection.selectedIds).not.toContain(locked.id)
  })

  it('isSelected reflects multi-selection membership', () => {
    const [a, b] = seedObjects(2)
    const selection = useSelectionStore()
    selection.selectRange([a!])
    expect(selection.isSelected(a!)).toBe(true)
    expect(selection.isSelected(b!)).toBe(false)
  })

  it('makePrimary only changes selectedId when the id is already selected', () => {
    const [a, b] = seedObjects(2)
    const selection = useSelectionStore()
    selection.selectRange([a!, b!])
    selection.makePrimary(a!)
    expect(selection.selectedId).toBe(a)
    expect(selection.selectedIds).toEqual([a, b]) // untouched

    selection.makePrimary('not-in-selection')
    expect(selection.selectedId).toBe(a) // unchanged — no-op
  })

  it('clicking a member already in a multi-selection does not clear the rest', () => {
    const [a, b] = seedObjects(2)
    const selection = useSelectionStore()
    selection.selectRange([a!, b!])
    selection.makePrimary(b!)
    expect(selection.selectedIds).toEqual([a, b])
  })

  it('deleteSelected on a multi-selection removes every selected object in one call', () => {
    const [a, b, c] = seedObjects(3)
    const scene = useSceneStore()
    const selection = useSelectionStore()
    selection.selectRange([a!, b!])
    selection.deleteSelected()
    expect(scene.objects.map(o => o.id)).toEqual([c])
    expect(selection.selectedIds).toEqual([])
  })

  it('selectedObjects getter resolves the full multi-selection, dropping missing ids', () => {
    const [a, b] = seedObjects(2)
    const scene = useSceneStore()
    const selection = useSelectionStore()
    selection.selectRange([a!, b!])
    scene.removeObject(b!)
    expect(selection.selectedObjects.map(o => o.id)).toEqual([a])
  })
})
