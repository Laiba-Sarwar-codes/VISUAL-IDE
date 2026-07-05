import { describe, expect, it, vi } from 'vitest'
import { ReactiveStateManager } from '../../src/priority2/state/ReactiveStateManager'

describe('ReactiveStateManager', () => {
  it('updates state and notifies subscribers', () => {
    const manager = new ReactiveStateManager({ count: 0, name: 'a' })
    const listener = vi.fn()
    manager.subscribe(listener)
    manager.setState({ count: 1 }, 'Increment')
    expect(manager.snapshot.count).toBe(1)
    expect(listener).toHaveBeenCalledWith(
      { count: 1, name: 'a' },
      { count: 0, name: 'a' },
      'Increment',
    )
  })

  it('batches a transaction into one history frame', () => {
    const manager = new ReactiveStateManager({ count: 0 })
    manager.transaction('Two updates', () => {
      manager.setState({ count: 1 })
      manager.setState({ count: 2 })
    })
    expect(manager.snapshot.count).toBe(2)
    expect(manager.historySize).toBe(2)
  })

  it('supports undo, redo and time travel', () => {
    const manager = new ReactiveStateManager({ count: 0 })
    manager.setState({ count: 1 }, 'One')
    manager.setState({ count: 2 }, 'Two')
    expect(manager.undo()).toBe(true)
    expect(manager.snapshot.count).toBe(1)
    expect(manager.redo()).toBe(true)
    expect(manager.snapshot.count).toBe(2)
    expect(manager.timeTravel(0)).toBe(true)
    expect(manager.snapshot.count).toBe(0)
  })

  it('supports selector subscriptions', () => {
    const manager = new ReactiveStateManager({ count: 0, name: 'a' })
    const listener = vi.fn()
    manager.subscribeSelector((state) => state.count, listener)
    manager.setState({ name: 'b' })
    manager.setState({ count: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(2, 0)
  })

  it('hydrates and persists through an adapter', async () => {
    let persisted = { count: 9 }
    const manager = new ReactiveStateManager({ count: 0 }, {
      persistence: {
        async load() { return persisted },
        async save(state) { persisted = { ...state } },
      },
    })
    expect(await manager.hydrate()).toBe(true)
    expect(manager.snapshot.count).toBe(9)
    manager.setState({ count: 10 })
    await Promise.resolve()
    expect(persisted.count).toBe(10)
  })
})
