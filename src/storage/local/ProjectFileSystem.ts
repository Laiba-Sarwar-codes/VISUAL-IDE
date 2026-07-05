// src/storage/local/ProjectFileSystem.ts
// Module 14 — persists and restores Yjs document state

import { nanoid } from 'nanoid'
import { IndexedDBService } from './IndexedDBService'
import { normalizeHierarchy } from '../../layers/layerMigration'
import { CURRENT_SCHEMA_VERSION } from './types'
import type { Project, ProjectMeta } from './types'
import type { SceneObject } from '../../engine/scene-graph/types'

async function createProject(name = 'Untitled Project'): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id: nanoid(),
    name,
    createdAt: now,
    updatedAt: now,
    objects: [],
    camera: { x: 0, y: 0, zoom: 1 },
    meta: { activeTool: 'select', version: CURRENT_SCHEMA_VERSION },
  }
  await IndexedDBService.setProject(project)
  await IndexedDBService.setMeta(buildMeta(project))
  return project
}

/**
 * Why: accepts an optional Uint8Array (the Yjs encoded state) and
 * converts it to number[] for JSON/IndexedDB storage. On load, we
 * convert back to Uint8Array so crdtService.load() can restore the
 * exact CRDT document state.
 */
async function saveProject(
  id: string,
  objects: SceneObject[],
  camera: { x: number; y: number; zoom: number },
  activeTool: string,
  yjsUpdate?: Uint8Array
): Promise<void> {
  const existing = await IndexedDBService.getProject(id)
  if (!existing) throw new Error(`Project ${id} not found`)

  const updated: Project = {
    ...existing,
    objects,
    camera,
    updatedAt: Date.now(),
    meta: { ...existing.meta, activeTool, version: CURRENT_SCHEMA_VERSION },
    // Convert Uint8Array → number[] for IndexedDB serialization
    yjsUpdate: yjsUpdate ? Array.from(yjsUpdate) : existing.yjsUpdate,
  }

  await IndexedDBService.setProject(updated)
  await IndexedDBService.setMeta(buildMeta(updated))
}

/**
 * Why: normalizeHierarchy runs unconditionally here — cheap, idempotent,
 * and means old flat projects (no parentId at all) and any corrupted/
 * dangling/circular hierarchy data are both repaired at the single point
 * every project load passes through, so the rest of the app never has to
 * reason about malformed hierarchy state (see layerMigration.ts).
 */
async function loadProject(id: string): Promise<Project | null> {
  const project = await IndexedDBService.getProject(id)
  if (!project) return null
  return { ...project, objects: normalizeHierarchy(project.objects) }
}

async function listProjects(): Promise<ProjectMeta[]> {
  const metas = await IndexedDBService.getAllMeta()
  return metas.sort((a, b) => b.updatedAt - a.updatedAt)
}

async function renameProject(id: string, name: string): Promise<void> {
  const project = await IndexedDBService.getProject(id)
  if (!project) return
  project.name = name
  project.updatedAt = Date.now()
  await IndexedDBService.setProject(project)
  await IndexedDBService.setMeta(buildMeta(project))
}

async function deleteProject(id: string): Promise<void> {
  await IndexedDBService.removeProject(id)
  await IndexedDBService.removeMeta(id)
}

async function exportProjectJSON(id: string): Promise<void> {
  const project = await IndexedDBService.getProject(id)
  if (!project) return
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importProjectJSON(file: File): Promise<Project> {
  const text = await file.text()
  const parsed = JSON.parse(text) as Project
  const now = Date.now()
  const imported: Project = {
    ...parsed,
    id: nanoid(),
    name: `${parsed.name} (imported)`,
    createdAt: now,
    updatedAt: now,
    objects: normalizeHierarchy(parsed.objects ?? []),
  }
  await IndexedDBService.setProject(imported)
  await IndexedDBService.setMeta(buildMeta(imported))
  return imported
}

function buildMeta(p: Project): ProjectMeta {
  return {
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    objectCount: p.objects.length,
  }
}

export const ProjectFileSystem = {
  createProject,
  saveProject,
  loadProject,
  listProjects,
  renameProject,
  deleteProject,
  exportProjectJSON,
  importProjectJSON,
}