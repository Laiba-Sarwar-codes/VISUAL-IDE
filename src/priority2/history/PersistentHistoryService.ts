import { nanoid } from 'nanoid'
import type { SceneObject } from '../../engine/scene-graph/types'
import type { Priority2DatabaseLike } from '../storage/Priority2Database'

export interface PersistentHistoryEntry {
  id: string
  projectId: string
  transactionId: string
  label: string
  before: SceneObject[]
  after: SceneObject[]
  createdAt: number
}

interface PersistentHistoryRecord {
  id: string
  projectId: string
  entries: PersistentHistoryEntry[]
  cursor: number
  currentSnapshot: SceneObject[]
  updatedAt: number
}

export interface HistorySnapshotResult {
  snapshot: SceneObject[]
  label: string
}

/**
 * Persistent, unlimited scene history with batching and explicit transactions.
 * Entries are stored per project and survive refreshes. The cursor points to
 * the next entry that redo would apply.
 */
export class PersistentHistoryService {
  private entries: PersistentHistoryEntry[] = []
  private cursor = 0
  private currentSnapshot: SceneObject[] = []
  private transaction: {
    id: string
    label: string
    before: SceneObject[]
    after: SceneObject[]
  } | null = null
  private pendingTimer: ReturnType<typeof setTimeout> | null = null
  private pendingSnapshot: SceneObject[] | null = null
  private pendingLabel = 'Edit scene'

  constructor(
    private readonly database: Priority2DatabaseLike,
    readonly projectId: string,
    private readonly batchDelayMs = 220,
  ) {}

  get canUndo(): boolean { return this.cursor > 0 }
  get canRedo(): boolean { return this.cursor < this.entries.length }
  get undoLabel(): string | null { return this.canUndo ? this.entries[this.cursor - 1]?.label ?? null : null }
  get redoLabel(): string | null { return this.canRedo ? this.entries[this.cursor]?.label ?? null : null }
  get size(): number { return this.entries.length }
  get position(): number { return this.cursor }
  /** UI redesign — minimal read-only projection for the History screen (id/label/timestamp only, never the before/after scene snapshots). */
  get historyEntries(): Array<{ id: string; label: string; createdAt: number }> {
    return this.entries.map(e => ({ id: e.id, label: e.label, createdAt: e.createdAt }))
  }

  async initialize(initialSnapshot: SceneObject[]): Promise<void> {
    const restored = await this.database.get<PersistentHistoryRecord>('history', this.projectId)
    if (restored) {
      this.entries = restored.entries.map(cloneEntry)
      this.cursor = clamp(restored.cursor, 0, this.entries.length)
      this.currentSnapshot = cloneScene(restored.currentSnapshot)
      return
    }

    this.entries = []
    this.cursor = 0
    this.currentSnapshot = cloneScene(initialSnapshot)
    await this.persist()
  }

  schedule(snapshot: SceneObject[], label = 'Edit scene'): void {
    this.pendingSnapshot = cloneScene(snapshot)
    this.pendingLabel = label
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null
      void this.flush()
    }, this.batchDelayMs)
  }

  beginTransaction(label: string): string {
    if (this.transaction) return this.transaction.id
    const id = nanoid()
    this.transaction = {
      id,
      label,
      before: cloneScene(this.currentSnapshot),
      after: cloneScene(this.currentSnapshot),
    }
    return id
  }

  updateTransaction(snapshot: SceneObject[]): void {
    if (!this.transaction) {
      this.schedule(snapshot)
      return
    }
    this.transaction.after = cloneScene(snapshot)
  }

  async commitTransaction(): Promise<boolean> {
    const transaction = this.transaction
    this.transaction = null
    if (!transaction || scenesEqual(transaction.before, transaction.after)) return false
    await this.append(transaction.before, transaction.after, transaction.label, transaction.id)
    return true
  }

  cancelTransaction(): void {
    this.transaction = null
  }

  async flush(): Promise<boolean> {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer)
      this.pendingTimer = null
    }

    const after = this.pendingSnapshot
    const label = this.pendingLabel
    this.pendingSnapshot = null
    if (!after) return false

    if (this.transaction) {
      this.transaction.after = cloneScene(after)
      return false
    }

    if (scenesEqual(this.currentSnapshot, after)) return false
    await this.append(this.currentSnapshot, after, label, nanoid())
    return true
  }

  async undo(): Promise<HistorySnapshotResult | null> {
    await this.flush()
    if (!this.canUndo) return null
    const entry = this.entries[this.cursor - 1]
    if (!entry) return null
    this.cursor -= 1
    this.currentSnapshot = cloneScene(entry.before)
    await this.persist()
    return { snapshot: cloneScene(entry.before), label: entry.label }
  }

  async redo(): Promise<HistorySnapshotResult | null> {
    await this.flush()
    if (!this.canRedo) return null
    const entry = this.entries[this.cursor]
    if (!entry) return null
    this.cursor += 1
    this.currentSnapshot = cloneScene(entry.after)
    await this.persist()
    return { snapshot: cloneScene(entry.after), label: entry.label }
  }

  async clear(snapshot: SceneObject[] = []): Promise<void> {
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.pendingTimer = null
    this.pendingSnapshot = null
    this.transaction = null
    this.entries = []
    this.cursor = 0
    this.currentSnapshot = cloneScene(snapshot)
    await this.persist()
  }

  async replaceCurrentSnapshot(snapshot: SceneObject[]): Promise<void> {
    this.currentSnapshot = cloneScene(snapshot)
    await this.persist()
  }

  async dispose(): Promise<void> {
    await this.flush()
  }

  private async append(
    before: SceneObject[],
    after: SceneObject[],
    label: string,
    transactionId: string,
  ): Promise<void> {
    if (this.cursor < this.entries.length) this.entries.splice(this.cursor)

    this.entries.push({
      id: nanoid(),
      projectId: this.projectId,
      transactionId,
      label,
      before: cloneScene(before),
      after: cloneScene(after),
      createdAt: Date.now(),
    })
    this.cursor = this.entries.length
    this.currentSnapshot = cloneScene(after)
    await this.persist()
  }

  private async persist(): Promise<void> {
    await this.database.put<PersistentHistoryRecord>('history', {
      id: this.projectId,
      projectId: this.projectId,
      entries: this.entries.map(cloneEntry),
      cursor: this.cursor,
      currentSnapshot: cloneScene(this.currentSnapshot),
      updatedAt: Date.now(),
    })
  }
}

function cloneScene(objects: SceneObject[]): SceneObject[] {
  // structuredClone throws on Vue's reactive Proxy-wrapped arrays/objects
  // (scene.objects is passed in directly from a Pinia store), so fall back
  // to a JSON round-trip, which reads through Proxies transparently.
  try {
    if (typeof structuredClone === 'function') return structuredClone(objects)
  } catch {
    // fall through
  }
  return JSON.parse(JSON.stringify(objects)) as SceneObject[]
}

function cloneEntry(entry: PersistentHistoryEntry): PersistentHistoryEntry {
  return {
    ...entry,
    before: cloneScene(entry.before),
    after: cloneScene(entry.after),
  }
}

function scenesEqual(left: SceneObject[], right: SceneObject[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
