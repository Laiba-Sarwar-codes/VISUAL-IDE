// tests/unit/LayerHierarchyService.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createFolder, deleteFolder, renameNode, reparent } from '../../src/layers/LayerHierarchyService'
import { makeObject, resetIdCounter } from './helpers'

beforeEach(() => resetIdCounter())

describe('createFolder', () => {
  it('creates a root-level folder by default', () => {
    const { objects, folderId } = createFolder([], 'My Folder')
    const folder = objects.find(o => o.id === folderId)
    expect(folder?.type).toBe('folder')
    expect(folder?.parentId).toBeNull()
    expect(folder?.name).toBe('My Folder')
  })

  it('creates a nested folder inside a parent folder', () => {
    const { objects: withParent, folderId: parentId } = createFolder([], 'Parent')
    const { objects, folderId } = createFolder(withParent, 'Child', parentId)
    const child = objects.find(o => o.id === folderId)
    expect(child?.parentId).toBe(parentId)
  })

  it('does not create a visual canvas object with size', () => {
    const { objects, folderId } = createFolder([], 'Folder')
    const folder = objects.find(o => o.id === folderId)!
    expect(folder.width).toBe(0)
    expect(folder.height).toBe(0)
  })
})

describe('deleteFolder', () => {
  it('promotes children to the folder\'s parent instead of deleting them', () => {
    const { objects: withFolder, folderId } = createFolder([], 'Folder')
    const child = makeObject({ id: 'child', parentId: folderId })
    const result = deleteFolder([...withFolder, child], folderId)

    expect(result.find(o => o.id === folderId)).toBeUndefined() // folder gone
    expect(result.find(o => o.id === 'child')?.parentId).toBeNull() // child promoted, not deleted
  })

  it('promotes children to a grandparent when the folder itself is nested', () => {
    const { objects: withParent, folderId: parentId } = createFolder([], 'Parent')
    const { objects: withChild, folderId: childFolderId } = createFolder(withParent, 'Child Folder', parentId)
    const leaf = makeObject({ id: 'leaf', parentId: childFolderId })
    const result = deleteFolder([...withChild, leaf], childFolderId)

    expect(result.find(o => o.id === 'leaf')?.parentId).toBe(parentId)
  })

  it('is a no-op for a non-folder id', () => {
    const objects = [makeObject({ id: 'a' })]
    const result = deleteFolder(objects, 'a')
    expect(result).toBe(objects)
  })
})

describe('renameNode', () => {
  it('renames a node', () => {
    const objects = [makeObject({ id: 'a', name: 'Old' })]
    const result = renameNode(objects, 'a', 'New')
    expect(result.find(o => o.id === 'a')?.name).toBe('New')
  })

  it('rejects a blank name (no-op)', () => {
    const objects = [makeObject({ id: 'a', name: 'Old' })]
    const result = renameNode(objects, 'a', '   ')
    expect(result).toBe(objects)
  })
})

describe('reparent', () => {
  it('moves a node under a new parent', () => {
    const parent = makeObject({ id: 'p', type: 'folder' })
    const child = makeObject({ id: 'c' })
    const result = reparent([parent, child], 'c', 'p')
    expect(result.find(o => o.id === 'c')?.parentId).toBe('p')
  })

  it('rejects reparenting a node under itself', () => {
    const objects = [makeObject({ id: 'a' })]
    const result = reparent(objects, 'a', 'a')
    expect(result).toBe(objects)
  })

  it('rejects reparenting a node under its own descendant (circular)', () => {
    const parent = makeObject({ id: 'p', type: 'group' })
    const child = makeObject({ id: 'c', type: 'group', parentId: 'p' })
    const objects = [parent, child]
    const result = reparent(objects, 'p', 'c')
    expect(result).toBe(objects) // rejected — same array reference returned unchanged
  })

  it('preserves relative order when inserting at a specific index', () => {
    const a = makeObject({ id: 'a', parentId: null, zIndex: 0 })
    const b = makeObject({ id: 'b', parentId: null, zIndex: 1 })
    const moving = makeObject({ id: 'm', parentId: 'other', zIndex: 0 })
    const result = reparent([a, b, moving], 'm', null, 1)
    const sorted = result.filter(o => (o.parentId ?? null) === null).sort((x, y) => x.zIndex - y.zIndex)
    expect(sorted.map(o => o.id)).toEqual(['a', 'm', 'b'])
  })
})
