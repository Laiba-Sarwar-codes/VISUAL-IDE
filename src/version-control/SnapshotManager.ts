// src/version-control/SnapshotManager.ts
// Module 20 — creates and stores immutable scene snapshots

import { nanoid } from 'nanoid'
import type { Snapshot } from './types'
import type { SceneObject } from '../engine/scene-graph/types'

export class SnapshotManager {
  private snapshots = new Map<string, Snapshot>()

  /**
   * Why: creates an immutable snapshot of the current scene state.
   * Uses JSON round-trip for a fast deep clone — scene objects are
   * pure data (no functions/methods), so JSON is safe and simpler
   * than structuredClone which isn't available everywhere.
   * Inputs: current scene objects array.
   * Output: new Snapshot with a fresh id.
   * Called by: VersionControlService.createCommit().
   */
  create(objects: SceneObject[]): Snapshot {
    const snapshot: Snapshot = {
      id: nanoid(),
      objects: JSON.parse(JSON.stringify(objects)) as SceneObject[],
      createdAt: Date.now(),
    }
    this.snapshots.set(snapshot.id, snapshot)
    return snapshot
  }

  get(id: string): Snapshot | undefined {
    return this.snapshots.get(id)
  }

  has(id: string): boolean {
    return this.snapshots.has(id)
  }

  /**
   * Why: called after garbage collection when a commit is deleted.
   * Only removes if no other commit references this snapshot id.
   * The service passes the current set of referenced ids to check.
   */
  remove(id: string, referencedIds: Set<string>): boolean {
    if (referencedIds.has(id)) return false
    return this.snapshots.delete(id)
  }

  getAll(): Snapshot[] {
    return Array.from(this.snapshots.values())
  }

  /**
   * Why: used when loading a repository from persistence — the store
   * receives the raw snapshots and needs to hydrate the internal map
   * without triggering creation logic.
   */
  hydrate(snapshots: Snapshot[]): void {
    this.snapshots.clear()
    for (const snap of snapshots) {
      this.snapshots.set(snap.id, snap)
    }
  }

  clear(): void {
    this.snapshots.clear()
  }
}