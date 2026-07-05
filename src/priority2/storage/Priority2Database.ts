export type Priority2StoreName =
  | 'history'
  | 'binary-blocks'
  | 'binary-manifests'
  | 'repositories'
  | 'runtime'

export interface IdentifiedRecord {
  id: string
}

export interface Priority2DatabaseLike {
  get<T>(store: Priority2StoreName, id: string): Promise<T | null>
  put<T extends IdentifiedRecord>(store: Priority2StoreName, value: T): Promise<void>
  delete(store: Priority2StoreName, id: string): Promise<void>
  getAll<T>(store: Priority2StoreName): Promise<T[]>
}

const DB_NAME = 'collab-visual-ide-priority2'
const DB_VERSION = 1
const STORES: Priority2StoreName[] = [
  'history',
  'binary-blocks',
  'binary-manifests',
  'repositories',
  'runtime',
]

/**
 * Separate Priority 2 database.
 *
 * Keeping these records in a new database lets the new systems be added
 * without changing the existing project/asset IndexedDB schema. If IndexedDB
 * is unavailable, the adapter falls back to memory so the editor remains
 * usable instead of crashing.
 */
export class Priority2Database implements Priority2DatabaseLike {
  private databasePromise: Promise<IDBDatabase> | null = null
  private readonly memoryFallback = new MemoryPriority2Database()
  private fallbackEnabled = false

  async get<T>(store: Priority2StoreName, id: string): Promise<T | null> {
    if (this.fallbackEnabled || typeof indexedDB === 'undefined') {
      return this.memoryFallback.get<T>(store, id)
    }

    try {
      const db = await this.open()
      return await new Promise<T | null>((resolve, reject) => {
        const transaction = db.transaction(store, 'readonly')
        const request = transaction.objectStore(store).get(id)
        request.onsuccess = () => resolve((request.result as T | undefined) ?? null)
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      this.enableFallback(error)
      return this.memoryFallback.get<T>(store, id)
    }
  }

  async put<T extends IdentifiedRecord>(store: Priority2StoreName, value: T): Promise<void> {
    if (this.fallbackEnabled || typeof indexedDB === 'undefined') {
      return this.memoryFallback.put(store, value)
    }

    try {
      const db = await this.open()
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(store, 'readwrite')
        transaction.objectStore(store).put(value)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    } catch (error) {
      this.enableFallback(error)
      await this.memoryFallback.put(store, value)
    }
  }

  async delete(store: Priority2StoreName, id: string): Promise<void> {
    if (this.fallbackEnabled || typeof indexedDB === 'undefined') {
      return this.memoryFallback.delete(store, id)
    }

    try {
      const db = await this.open()
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(store, 'readwrite')
        transaction.objectStore(store).delete(id)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    } catch (error) {
      this.enableFallback(error)
      await this.memoryFallback.delete(store, id)
    }
  }

  async getAll<T>(store: Priority2StoreName): Promise<T[]> {
    if (this.fallbackEnabled || typeof indexedDB === 'undefined') {
      return this.memoryFallback.getAll<T>(store)
    }

    try {
      const db = await this.open()
      return await new Promise<T[]>((resolve, reject) => {
        const transaction = db.transaction(store, 'readonly')
        const request = transaction.objectStore(store).getAll()
        request.onsuccess = () => resolve(request.result as T[])
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      this.enableFallback(error)
      return this.memoryFallback.getAll<T>(store)
    }
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        for (const storeName of STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' })
          }
        }
      }

      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => {
          db.close()
          this.databasePromise = null
        }
        resolve(db)
      }

      request.onerror = () => reject(request.error ?? new Error('Priority 2 database failed to open.'))
      request.onblocked = () => reject(new Error('Priority 2 database upgrade is blocked by another tab.'))
    })

    return this.databasePromise
  }

  private enableFallback(error: unknown): void {
    if (!this.fallbackEnabled) {
      console.warn('[Priority2Database] IndexedDB unavailable; using in-memory fallback.', error)
    }
    this.fallbackEnabled = true
    this.databasePromise = null
  }
}

/** In-memory implementation used by tests and browser fallback. */
export class MemoryPriority2Database implements Priority2DatabaseLike {
  private readonly stores = new Map<Priority2StoreName, Map<string, IdentifiedRecord>>()

  async get<T>(store: Priority2StoreName, id: string): Promise<T | null> {
    const record = this.getStore(store).get(id)
    return (record as T | undefined) ?? null
  }

  async put<T extends IdentifiedRecord>(store: Priority2StoreName, value: T): Promise<void> {
    this.getStore(store).set(value.id, value)
  }

  async delete(store: Priority2StoreName, id: string): Promise<void> {
    this.getStore(store).delete(id)
  }

  async getAll<T>(store: Priority2StoreName): Promise<T[]> {
    return [...this.getStore(store).values()] as T[]
  }

  private getStore(store: Priority2StoreName): Map<string, IdentifiedRecord> {
    let target = this.stores.get(store)
    if (!target) {
      target = new Map<string, IdentifiedRecord>()
      this.stores.set(store, target)
    }
    return target
  }
}

export const priority2Database = new Priority2Database()
