// src/collaboration/CRDTService.ts
// Module 14 — CRDT document lifecycle management
//
// Fix: onUpdate() now passes the Yjs transaction `origin` through
// to the callback so CRDTSyncBridge can distinguish local edits
// (origin = undefined/null) from remote peer updates
// (origin = 'collab:remote') and avoid echo-broadcasting them.
//
// applyRemoteUpdate() now accepts an optional `origin` parameter
// so callers can tag their transaction for the observer.

import * as Y from 'yjs'
import { nanoid } from 'nanoid'
import {
  createCollabDocument,
  loadCollabDocument,
  updateDocumentMeta,
} from './document'
import { awareness } from './Awareness'
import type { CollabDocument } from './document'

export class CRDTService {
  private collabDoc: CollabDocument | null = null
  private _initialized = false

  get isInitialized(): boolean { return this._initialized }
  get document(): CollabDocument | null { return this.collabDoc }

  /**
   * Creates a brand new Yjs document for a fresh project.
   */
  create(projectName = 'Untitled Project'): string {
    this.destroy()
    const documentId = nanoid()
    this.collabDoc = createCollabDocument(documentId, projectName)
    this._initialized = true
    console.log('[CRDTService] Document created:', documentId)
    return documentId
  }

  /**
   * Loads an existing Yjs document from a binary update.
   */
  load(update: Uint8Array, projectName = 'Untitled Project'): string {
    this.destroy()
    const doc = new Y.Doc()
    Y.applyUpdate(doc, update)
    this.collabDoc = loadCollabDocument(doc)

    if (!this.collabDoc.meta.get('documentId')) {
      const documentId = nanoid()
      updateDocumentMeta(this.collabDoc, {
        documentId,
        projectName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      })
    }

    this._initialized = true
    const id = this.collabDoc.meta.get('documentId') as string
    console.log('[CRDTService] Document loaded:', id)
    return id
  }

  /**
   * Exports the full document state as a binary Uint8Array.
   */
  export(): Uint8Array | null {
    if (!this.collabDoc) return null
    return Y.encodeStateAsUpdate(this.collabDoc.doc)
  }

  /**
   * Fix: applies a remote binary update using the provided origin tag.
   * The origin is passed to Y.applyUpdate() so the 'update' event
   * observer receives it and can skip re-broadcasting remote updates.
   *
   * @param update  The encoded Yjs update from a remote peer.
   * @param origin  Optional transaction origin. Pass 'collab:remote'
   *                to prevent the update being echoed back to peers.
   */
  applyRemoteUpdate(update: Uint8Array, origin?: unknown): void {
    if (!this.collabDoc) return
    Y.applyUpdate(this.collabDoc.doc, update, origin)
  }

  /**
   * Fix: the callback now receives (update, origin) so callers
   * can filter by origin to prevent echo loops.
   *
   * Yjs fires 'update' with signature (update: Uint8Array, origin: unknown).
   * We forward both parameters to the callback.
   */
  onUpdate(cb: (update: Uint8Array, origin: unknown) => void): () => void {
    if (!this.collabDoc) return () => {}
    const handler = (update: Uint8Array, origin: unknown) => cb(update, origin)
    this.collabDoc.doc.on('update', handler)
    return () => this.collabDoc?.doc.off('update', handler)
  }

  destroy(): void {
    if (this.collabDoc) {
      this.collabDoc.doc.destroy()
      this.collabDoc = null
      this._initialized = false
      console.log('[CRDTService] Document destroyed')
    }
  }

  getAwareness() { return awareness }
}

// Singleton — one CRDT document per session
export const crdtService = new CRDTService()