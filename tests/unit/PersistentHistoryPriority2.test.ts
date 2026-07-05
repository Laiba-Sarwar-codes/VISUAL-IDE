import { describe, expect, it } from 'vitest'
import { PersistentHistoryService } from '../../src/priority2/history/PersistentHistoryService'
import { MemoryPriority2Database } from '../../src/priority2/storage/Priority2Database'
import type { SceneObject } from '../../src/engine/scene-graph/types'

function object(x: number): SceneObject {
  return {
    id: 'object-1', name: 'Rectangle', type: 'rectangle', x, y: 0,
    width: 100, height: 100, rotation: 0, visible: true, locked: false,
    opacity: 1, fill: '#ffffff', stroke: '#000000', zIndex: 0,
  }
}

describe('PersistentHistoryService', () => {
  it('records, undoes and redoes complete scene snapshots', async () => {
    const database = new MemoryPriority2Database()
    const history = new PersistentHistoryService(database, 'project', 1)
    await history.initialize([object(0)])
    history.schedule([object(10)], 'Move rectangle')
    await history.flush()
    expect(history.canUndo).toBe(true)
    expect((await history.undo())?.snapshot[0]?.x).toBe(0)
    expect((await history.redo())?.snapshot[0]?.x).toBe(10)
  })

  it('survives service recreation', async () => {
    const database = new MemoryPriority2Database()
    const first = new PersistentHistoryService(database, 'project', 1)
    await first.initialize([object(0)])
    first.schedule([object(20)], 'Move')
    await first.flush()

    const restored = new PersistentHistoryService(database, 'project', 1)
    await restored.initialize([])
    expect(restored.size).toBe(1)
    expect(restored.canUndo).toBe(true)
    expect((await restored.undo())?.snapshot[0]?.x).toBe(0)
  })

  it('batches multiple scheduled snapshots into one entry', async () => {
    const database = new MemoryPriority2Database()
    const history = new PersistentHistoryService(database, 'project', 50)
    await history.initialize([object(0)])
    history.schedule([object(1)], 'Drag')
    history.schedule([object(2)], 'Drag')
    history.schedule([object(3)], 'Drag')
    await history.flush()
    expect(history.size).toBe(1)
    expect((await history.undo())?.snapshot[0]?.x).toBe(0)
  })

  it('supports explicit transactions', async () => {
    const database = new MemoryPriority2Database()
    const history = new PersistentHistoryService(database, 'project', 1)
    await history.initialize([object(0)])
    history.beginTransaction('Transform')
    history.updateTransaction([object(5)])
    history.updateTransaction([object(9)])
    expect(await history.commitTransaction()).toBe(true)
    expect(history.size).toBe(1)
    expect((await history.redo())).toBeNull()
    expect((await history.undo())?.snapshot[0]?.x).toBe(0)
  })

  it('truncates the redo branch after a new edit', async () => {
    const database = new MemoryPriority2Database()
    const history = new PersistentHistoryService(database, 'project', 1)
    await history.initialize([object(0)])
    history.schedule([object(1)])
    await history.flush()
    history.schedule([object(2)])
    await history.flush()
    await history.undo()
    history.schedule([object(7)])
    await history.flush()
    expect(history.canRedo).toBe(false)
    expect(history.size).toBe(2)
  })
})
