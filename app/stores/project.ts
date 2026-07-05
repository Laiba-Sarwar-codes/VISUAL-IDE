// app/stores/project.ts
// V1: Restores camera state when loading a project

import { defineStore } from 'pinia'
import { ProjectFileSystem } from '~~/src/storage/local/ProjectFileSystem'
import type { ProjectMeta } from '~~/src/storage/local/types'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface ProjectState {
  activeProjectId: string | null
  activeProjectName: string
  projects: ProjectMeta[]
  saveStatus: SaveStatus
  lastSavedAt: number | null
  isExplorerOpen: boolean
}

export const useProjectStore = defineStore('project', {
  state: (): ProjectState => ({
    activeProjectId: null,
    activeProjectName: 'Untitled Project',
    projects: [],
    saveStatus: 'unsaved',
    lastSavedAt: null,
    isExplorerOpen: false,
  }),

  actions: {
    async refreshProjects(): Promise<void> {
      this.projects = await ProjectFileSystem.listProjects()
    },

    async createProject(name?: string): Promise<string> {
      const project = await ProjectFileSystem.createProject(name)
      this.activeProjectId = project.id
      this.activeProjectName = project.name
      this.saveStatus = 'saved'
      this.lastSavedAt = Date.now()
      await this.refreshProjects()
      return project.id
    },

    async saveProject(
      objects: import('~~/src/engine/scene-graph/types').SceneObject[],
      camera: { x: number; y: number; zoom: number },
      activeTool: string
    ): Promise<void> {
      if (!this.activeProjectId) return
      this.saveStatus = 'saving'
      try {
        const { crdtService } = await import('~~/src/collaboration/CRDTService')
        const yjsUpdate = crdtService.export() ?? undefined

        await ProjectFileSystem.saveProject(
          this.activeProjectId,
          objects,
          camera,
          activeTool,
          yjsUpdate
        )
        this.saveStatus = 'saved'
        this.lastSavedAt = Date.now()
        await this.refreshProjects()
      } catch {
        this.saveStatus = 'error'
      }
    },

    async loadProject(
      id: string
    ): Promise<import('~~/src/storage/local/types').Project | null> {
      const project = await ProjectFileSystem.loadProject(id)
      if (!project) return null

      this.activeProjectId = project.id
      this.activeProjectName = project.name
      this.saveStatus = 'saved'
      this.lastSavedAt = project.updatedAt

      // V1: restore camera position and zoom from saved project
      // Older records without camera.x/y default to 0
      const { useEditorStore } = await import('~/stores/editor')
      const editorStore = useEditorStore()
      editorStore.restoreCamera(
        project.camera?.x ?? 0,
        project.camera?.y ?? 0,
        project.camera?.zoom ?? 1
      )

      if (project.yjsUpdate && project.yjsUpdate.length > 0) {
        const { crdtService } = await import('~~/src/collaboration/CRDTService')
        const update = new Uint8Array(project.yjsUpdate)
        crdtService.load(update, project.name)
        console.log('[Project] CRDT document restored from saved state')
      }

      return project
    },

    async renameProject(id: string, name: string): Promise<void> {
      await ProjectFileSystem.renameProject(id, name)
      if (id === this.activeProjectId) this.activeProjectName = name
      await this.refreshProjects()
    },

    async deleteProject(id: string): Promise<void> {
      await ProjectFileSystem.deleteProject(id)
      if (id === this.activeProjectId) {
        this.activeProjectId = null
        this.activeProjectName = 'Untitled Project'
        this.saveStatus = 'unsaved'
      }
      await this.refreshProjects()
    },

    async exportProject(id: string): Promise<void> {
      await ProjectFileSystem.exportProjectJSON(id)
    },

    async importProject(file: File): Promise<void> {
      await ProjectFileSystem.importProjectJSON(file)
      await this.refreshProjects()
    },

    markUnsaved(): void {
      if (this.saveStatus === 'saved') this.saveStatus = 'unsaved'
    },
  },
})
