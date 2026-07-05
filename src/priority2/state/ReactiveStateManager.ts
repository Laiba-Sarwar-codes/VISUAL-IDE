export type StateUpdater<T> = Partial<T> | ((state: Readonly<T>) => T)
export type StateListener<T> = (state: Readonly<T>, previous: Readonly<T>, label: string) => void
export type Selector<T, S> = (state: Readonly<T>) => S

export interface StatePersistenceAdapter<T> {
  load(): Promise<T | null>
  save(state: Readonly<T>): Promise<void>
}

interface StateFrame<T> {
  label: string
  state: T
  createdAt: number
}

export interface StateManagerOptions<T> {
  historyLimit?: number
  persistence?: StatePersistenceAdapter<T>
  equals?: (left: T, right: T) => boolean
}

/**
 * Framework-independent reactive state manager used by Priority 2 systems.
 * It supports selectors, computed values, transactions, persistence, undo,
 * redo and explicit time travel without depending on Pinia.
 */
export class ReactiveStateManager<T extends object> {
  private state: T
  private readonly listeners = new Set<StateListener<T>>()
  private readonly history: StateFrame<T>[] = []
  private cursor = -1
  private transactionDepth = 0
  private transactionStart: T | null = null
  private transactionLabel = 'Transaction'
  private readonly historyLimit: number
  private readonly persistence?: StatePersistenceAdapter<T>
  private readonly equals: (left: T, right: T) => boolean

  constructor(initialState: T, options: StateManagerOptions<T> = {}) {
    this.state = clone(initialState)
    this.historyLimit = Math.max(1, options.historyLimit ?? 200)
    this.persistence = options.persistence
    this.equals = options.equals ?? ((left, right) => JSON.stringify(left) === JSON.stringify(right))
    this.pushFrame('Initial state', this.state)
  }

  get snapshot(): Readonly<T> {
    return clone(this.state)
  }

  get canUndo(): boolean {
    return this.cursor > 0
  }

  get canRedo(): boolean {
    return this.cursor >= 0 && this.cursor < this.history.length - 1
  }

  get historySize(): number {
    return this.history.length
  }

  subscribe(listener: StateListener<T>): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  select<S>(selector: Selector<T, S>): S {
    return selector(this.snapshot)
  }

  subscribeSelector<S>(
    selector: Selector<T, S>,
    listener: (selected: S, previous: S) => void,
    equals: (left: S, right: S) => boolean = Object.is,
  ): () => void {
    let previous = selector(this.snapshot)
    return this.subscribe((state) => {
      const selected = selector(state)
      if (equals(selected, previous)) return
      const old = previous
      previous = selected
      listener(selected, old)
    })
  }

  setState(updater: StateUpdater<T>, label = 'Update'): void {
    const previous = clone(this.state)
    const next = typeof updater === 'function'
      ? (updater as (state: Readonly<T>) => T)(this.snapshot)
      : { ...this.state, ...updater }

    if (this.equals(previous, next)) return
    this.state = clone(next)

    if (this.transactionDepth === 0) {
      this.pushFrame(label, this.state)
      void this.persist()
      this.notify(previous, label)
    }
  }

  transaction(label: string, action: () => void): void {
    const isOuter = this.transactionDepth === 0
    if (isOuter) {
      this.transactionStart = clone(this.state)
      this.transactionLabel = label
    }

    this.transactionDepth += 1
    try {
      action()
    } finally {
      this.transactionDepth -= 1
      if (isOuter) this.commitTransaction()
    }
  }

  undo(): boolean {
    if (!this.canUndo) return false
    const previous = clone(this.state)
    this.cursor -= 1
    const frame = this.history[this.cursor]
    if (!frame) return false
    this.state = clone(frame.state)
    void this.persist()
    this.notify(previous, `Undo: ${frame.label}`)
    return true
  }

  redo(): boolean {
    if (!this.canRedo) return false
    const previous = clone(this.state)
    this.cursor += 1
    const frame = this.history[this.cursor]
    if (!frame) return false
    this.state = clone(frame.state)
    void this.persist()
    this.notify(previous, `Redo: ${frame.label}`)
    return true
  }

  timeTravel(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.history.length) return false
    const previous = clone(this.state)
    this.cursor = index
    const frame = this.history[index]
    if (!frame) return false
    this.state = clone(frame.state)
    void this.persist()
    this.notify(previous, `Time travel: ${frame.label}`)
    return true
  }

  async hydrate(): Promise<boolean> {
    const restored = await this.persistence?.load()
    if (!restored) return false
    const previous = clone(this.state)
    this.state = clone(restored)
    this.history.length = 0
    this.cursor = -1
    this.pushFrame('Hydrated state', this.state)
    this.notify(previous, 'Hydrate')
    return true
  }

  private commitTransaction(): void {
    const before = this.transactionStart
    this.transactionStart = null
    if (!before || this.equals(before, this.state)) return
    this.pushFrame(this.transactionLabel, this.state)
    void this.persist()
    this.notify(before, this.transactionLabel)
  }

  private pushFrame(label: string, state: T): void {
    if (this.cursor < this.history.length - 1) {
      this.history.splice(this.cursor + 1)
    }

    this.history.push({ label, state: clone(state), createdAt: Date.now() })
    if (this.history.length > this.historyLimit) this.history.shift()
    this.cursor = this.history.length - 1
  }

  private notify(previous: T, label: string): void {
    const current = this.snapshot
    for (const listener of this.listeners) listener(current, previous, label)
  }

  private async persist(): Promise<void> {
    await this.persistence?.save(this.snapshot)
  }
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
