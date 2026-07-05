// src/storage/local/IndexedDBService.ts
// V1: Added STORE_ASSETS object store for binary blob persistence (DB_VERSION 2)

const DB_NAME = 'collab-visual-ide'
const DB_VERSION = 2  // bumped from 1 to add asset store
const STORE_PROJECTS = 'projects'
const STORE_META = 'project-meta'
const STORE_ASSETS = 'assets'  // V1: new store for binary asset blobs

let _db: IDBDatabase | null = null

/**
 * Why: DB_VERSION bumped to 2 to trigger onupgradeneeded and add the
 * assets object store. Existing project data is preserved — we only
 * add a new store, never drop the old ones.
 */
async function openDB(): Promise<IDBDatabase> {
  if (_db) return _db

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' })
      }

      // V1: asset store — keyed by asset id, indexed by projectId for
      // efficient project-scoped queries and cascade delete on project removal
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const assetStore = db.createObjectStore(STORE_ASSETS, { keyPath: 'id' })
        assetStore.createIndex('projectId', 'projectId', { unique: false })
      }
    }

    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result
      resolve(_db)
    }

    req.onerror = () => reject(req.error)
  })
}

async function get<T>(store: string, key: string): Promise<T | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve((req.result as T) ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function set<T>(store: string, value: T): Promise<void> {
  const db = await openDB()
  const safeValue = cloneForStorage(value)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(safeValue)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Why: IndexedDB's put() uses the structured clone algorithm internally,
 * which throws DataCloneError on Vue's reactive Proxy-wrapped objects/
 * arrays (e.g. saving `scene.objects` straight from the Pinia store) —
 * the same class of bug already fixed elsewhere in this codebase (see
 * PersistentHistoryService/PersistentVersionControl/priority2.client.ts's
 * clone() helpers) via a JSON round-trip fallback, which reads through
 * Proxies transparently. Tried first via structuredClone() so real
 * Blobs (asset records) clone correctly instead of being flattened by
 * JSON — Blob-bearing records are never Proxy-wrapped in this app, so
 * they always succeed on the first attempt and never hit the fallback.
 */
function cloneForStorage<T>(value: T): T {
  try {
    return structuredClone(value)
  } catch {
    return JSON.parse(JSON.stringify(value)) as T
  }
}

async function remove(store: string, key: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

/**
 * Why: query assets by projectId index so we can load all assets for
 * a project on load and delete them when a project is deleted.
 */
async function getAllByIndex<T>(store: string, indexName: string, value: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly')
    const index = tx.objectStore(store).index(indexName)
    const req = index.getAll(value)
    req.onsuccess = () => resolve(req.result as T[])
    req.onerror = () => reject(req.error)
  })
}

export const IndexedDBService = {
  getProject: (id: string) => get<import('./types').Project>(STORE_PROJECTS, id),
  setProject: (p: import('./types').Project) => set(STORE_PROJECTS, p),
  removeProject: (id: string) => remove(STORE_PROJECTS, id),
  getAllProjects: () => getAll<import('./types').Project>(STORE_PROJECTS),

  getMeta: (id: string) => get<import('./types').ProjectMeta>(STORE_META, id),
  setMeta: (m: import('./types').ProjectMeta) => set(STORE_META, m),
  removeMeta: (id: string) => remove(STORE_META, id),
  getAllMeta: () => getAll<import('./types').ProjectMeta>(STORE_META),

  // V1: asset persistence
  getAsset: (id: string) => get<import('./types').StoredAssetRecord>(STORE_ASSETS, id),
  setAsset: (a: import('./types').StoredAssetRecord) => set(STORE_ASSETS, a),
  removeAsset: (id: string) => remove(STORE_ASSETS, id),
  getAssetsByProject: (projectId: string) =>
    getAllByIndex<import('./types').StoredAssetRecord>(STORE_ASSETS, 'projectId', projectId),
}
