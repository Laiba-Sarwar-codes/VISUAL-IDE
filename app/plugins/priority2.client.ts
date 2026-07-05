import { nextTick, watch, type WatchStopHandle } from 'vue'
import type { ExportFormat } from '~~/src/export/types'
import { exporterRegistry } from '~~/src/export/ExporterRegistry'
import { commandRegistry } from '~~/src/commands/CommandRegistry'
import { crdtService } from '~~/src/collaboration/CRDTService'
import { versionControlService } from '~~/src/version-control/VersionControlService'
import { useEditorStore } from '~/stores/editor'
import { useExportStore } from '~/stores/export'
import { useHistoryStore } from '~/stores/history'
import { useProjectStore } from '~/stores/project'
import { useSceneStore } from '~/stores/scene'
import { useVersionControlStore } from '~/stores/versionControl'
import { BinaryBlockStore } from '~~/src/priority2/storage/BinaryBlockStore'
import { priority2Database } from '~~/src/priority2/storage/Priority2Database'
import { PersistentHistoryService } from '~~/src/priority2/history/PersistentHistoryService'
import { createPriority2RuntimeState } from '~~/src/priority2/state/Priority2RuntimeState'
import { PersistentVersionControl, type MergeMetadata } from '~~/src/priority2/version-control/PersistentVersionControl'
import { normalizeHierarchy } from '~~/src/layers/layerMigration'
import { ManualCollaborationSession } from '~~/src/priority2/collaboration/ManualCollaborationSession'
import { Priority2WorkerPool } from '~~/src/priority2/workers/Priority2WorkerPool'
import {
  HTMLExporterPriority2,
  PDFExporterPriority2,
  ZIPExporterPriority2,
} from '~~/src/priority2/export/Priority2Exporters'

interface Priority2RuntimeApi {
  database: typeof priority2Database
  binaryStore: BinaryBlockStore
  runtimeState: ReturnType<typeof createPriority2RuntimeState>
  manualCollaboration: ManualCollaborationSession
  workers: Priority2WorkerPool
  persistentVersionControl: PersistentVersionControl
  getPersistentHistory(): PersistentHistoryService | null
}

type Priority2Window = Window & { __COLLAB_PRIORITY2__?: Priority2RuntimeApi }

/**
 * Priority 2 is installed entirely as a new auto-loaded Nuxt plugin. Existing
 * components and styles remain byte-for-byte unchanged, so the Version 1.1 UI
 * is preserved while the new services are connected at runtime.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const project = useProjectStore()
  const scene = useSceneStore()
  const editor = useEditorStore()
  const historyStore = useHistoryStore()
  const versionStore = useVersionControlStore()
  const exportStore = useExportStore()

  const binaryStore = new BinaryBlockStore(priority2Database)
  const runtimeState = createPriority2RuntimeState(priority2Database)
  const persistentVersionControl = new PersistentVersionControl(priority2Database)
  const manualCollaboration = new ManualCollaborationSession(crdtService)
  const workers = new Priority2WorkerPool()

  let persistentHistory: PersistentHistoryService | null = null
  let historyGeneration = 0
  let suppressHistoryWatch = false
  let historySyncTimer: ReturnType<typeof setTimeout> | null = null
  let binaryTimer: ReturnType<typeof setTimeout> | null = null
  let repositoryMerges: MergeMetadata[] = []
  const stopHandles: WatchStopHandle[] = []

  registerExporters()
  patchPersistentHistory()
  patchPersistentVersionControl()
  registerCommands()

  manualCollaboration.onStateChange((state) => {
    runtimeState.setState({ manualConnectionState: state }, 'Manual collaboration state')
    editor.setStatusMessage(`Cross-device collaboration: ${state}`)
  })

  void runtimeState.hydrate()

  stopHandles.push(watch(
    () => project.activeProjectId,
    (projectId) => {
      runtimeState.setState({ projectId }, 'Active project')
      void initializeHistory(projectId)
      if (projectId) void hydrateRepository(projectId)
    },
    { immediate: true },
  ))

  stopHandles.push(watch(
    () => scene.objects,
    (objects) => {
      if (!suppressHistoryWatch && persistentHistory) {
        persistentHistory.schedule(objects, 'Edit scene')
        scheduleHistoryStoreSync()
      }
      scheduleBinarySnapshot()
    },
    { deep: true },
  ))

  const runtimeApi: Priority2RuntimeApi = {
    database: priority2Database,
    binaryStore,
    runtimeState,
    manualCollaboration,
    workers,
    persistentVersionControl,
    getPersistentHistory: () => persistentHistory,
  }

  ;(window as Priority2Window).__COLLAB_PRIORITY2__ = runtimeApi
  nuxtApp.provide('priority2', runtimeApi)

  const cleanup = (): void => {
    window.removeEventListener('beforeunload', cleanup)
    stopHandles.forEach((stop) => stop())
    if (historySyncTimer) clearTimeout(historySyncTimer)
    if (binaryTimer) clearTimeout(binaryTimer)
    void persistentHistory?.dispose()
    manualCollaboration.close()
    workers.terminate()
    delete (window as Priority2Window).__COLLAB_PRIORITY2__
  }

  window.addEventListener('beforeunload', cleanup, { once: true })
  if (import.meta.hot) import.meta.hot.dispose(cleanup)

  function registerExporters(): void {
    exporterRegistry.register(PDFExporterPriority2)
    exporterRegistry.register(HTMLExporterPriority2)
    exporterRegistry.register(ZIPExporterPriority2)
  }

  function patchPersistentHistory(): void {
    const originalInit = historyStore.init.bind(historyStore)

    historyStore.init = (() => {
      originalInit()
      syncHistoryStore()
    }) as typeof historyStore.init

    historyStore.sync = (() => {
      syncHistoryStore()
    }) as typeof historyStore.sync

    historyStore.undo = (() => {
      void applyPersistentHistory('undo')
    }) as typeof historyStore.undo

    historyStore.redo = (() => {
      void applyPersistentHistory('redo')
    }) as typeof historyStore.redo

    historyStore.clear = (() => {
      void persistentHistory?.clear(scene.objects).then(syncHistoryStore)
    }) as typeof historyStore.clear
  }

  function patchPersistentVersionControl(): void {
    const originalInit = versionStore.initForProject.bind(versionStore)
    const originalCreateCommit = versionStore.createCommit.bind(versionStore)
    const originalRestoreCommit = versionStore.restoreCommit.bind(versionStore)
    const originalCreateBranch = versionStore.createBranch.bind(versionStore)
    const originalSwitchBranch = versionStore.switchBranch.bind(versionStore)

    versionStore.initForProject = ((projectId: string) => {
      originalInit(projectId)
      void hydrateRepository(projectId)
    }) as typeof versionStore.initForProject

    versionStore.createCommit = ((message: string) => {
      const commit = originalCreateCommit(message)
      if (commit) void persistCurrentRepository()
      return commit
    }) as typeof versionStore.createCommit

    versionStore.restoreCommit = ((commitId: string) => {
      const restored = originalRestoreCommit(commitId)
      if (restored) void persistCurrentRepository()
      return restored
    }) as typeof versionStore.restoreCommit

    versionStore.createBranch = ((name: string) => {
      const created = originalCreateBranch(name)
      if (created) void persistCurrentRepository()
      return created
    }) as typeof versionStore.createBranch

    versionStore.switchBranch = ((branchId: string) => {
      originalSwitchBranch(branchId)
      void persistCurrentRepository()
    }) as typeof versionStore.switchBranch
  }

  async function initializeHistory(projectId: string | null): Promise<void> {
    const generation = ++historyGeneration
    await persistentHistory?.dispose()
    if (generation !== historyGeneration) return

    persistentHistory = projectId
      ? new PersistentHistoryService(priority2Database, projectId)
      : null

    if (persistentHistory) await persistentHistory.initialize(scene.objects)
    if (generation !== historyGeneration) return
    syncHistoryStore()
  }

  async function applyPersistentHistory(direction: 'undo' | 'redo'): Promise<void> {
    const service = persistentHistory
    if (!service) return
    const result = direction === 'undo' ? await service.undo() : await service.redo()
    if (!result) return

    suppressHistoryWatch = true
    scene._setAllRaw(clone(result.snapshot))
    await nextTick()
    suppressHistoryWatch = false
    syncHistoryStore()
    editor.setStatusMessage(`${direction === 'undo' ? 'Undo' : 'Redo'}: ${result.label}`)
  }

  function syncHistoryStore(): void {
    historyStore.canUndo = persistentHistory?.canUndo ?? false
    historyStore.canRedo = persistentHistory?.canRedo ?? false
    historyStore.undoLabel = persistentHistory?.undoLabel ?? null
    historyStore.redoLabel = persistentHistory?.redoLabel ?? null
    historyStore.stackSize = persistentHistory?.size ?? 0
    runtimeState.setState({
      historyEntries: persistentHistory?.size ?? 0,
      historyCursor: persistentHistory?.position ?? 0,
    }, 'History metrics')
  }

  function scheduleHistoryStoreSync(): void {
    if (historySyncTimer) clearTimeout(historySyncTimer)
    historySyncTimer = setTimeout(async () => {
      await persistentHistory?.flush()
      syncHistoryStore()
    }, 260)
  }

  function scheduleBinarySnapshot(): void {
    if (binaryTimer) clearTimeout(binaryTimer)
    binaryTimer = setTimeout(() => { void saveBinarySnapshot() }, 900)
  }

  async function saveBinarySnapshot(): Promise<void> {
    const projectId = project.activeProjectId
    if (!projectId) return
    const payload = new TextEncoder().encode(JSON.stringify({
      schema: 2,
      projectId,
      projectName: project.activeProjectName,
      objects: scene.objects,
    }))
    const result = await binaryStore.putDocument(`scene:${projectId}`, payload, {
      mimeType: 'application/vnd.collab-ide.scene+json',
      metadata: {
        projectId,
        objectCount: scene.objects.length,
      },
    })
    runtimeState.setState({
      lastBinaryWriteAt: Date.now(),
      lastBinaryChangedBlocks: result.changedBlocks,
    }, 'Binary snapshot')
  }

  async function hydrateRepository(projectId: string): Promise<void> {
    const record = await persistentVersionControl.load(projectId)
    if (record) {
      repositoryMerges = record.merges
      versionControlService.hydrate(record.repository)
      versionStore.sync()
      return
    }
    repositoryMerges = []
    await persistCurrentRepository()
  }

  async function persistCurrentRepository(): Promise<void> {
    const repository = versionControlService.getRepository()
    if (!repository) return
    await persistentVersionControl.save(repository, repositoryMerges)
  }

  function registerCommands(): void {
    registerExportCommand('pdf', 'Export as PDF', '📕')
    registerExportCommand(extendedFormat('html'), 'Export as HTML', '🌐')
    registerExportCommand(extendedFormat('zip'), 'Export complete project ZIP', '🗜')

    commandRegistry.registerMany([
      {
        id: 'priority2:collaboration-create-offer',
        label: 'Collaboration: Create Cross-Device Offer',
        description: 'Copies a backend-free WebRTC offer token.',
        category: 'Collaboration',
        icon: '🔗',
        keywords: ['webrtc', 'manual', 'offer', 'cross-device', 'peer'],
        handler: async () => {
          ensureCRDT()
          const token = await manualCollaboration.createOfferToken()
          await copyOrPrompt('Offer token — send this to the second device:', token)
          editor.setStatusMessage('Cross-device offer token created.')
        },
      },
      {
        id: 'priority2:collaboration-accept-offer',
        label: 'Collaboration: Accept Cross-Device Offer',
        description: 'Creates and copies an answer token from a received offer.',
        category: 'Collaboration',
        icon: '🤝',
        keywords: ['webrtc', 'manual', 'answer', 'cross-device', 'peer'],
        handler: async () => {
          const offer = prompt('Paste the offer token from the first device:')?.trim()
          if (!offer) return
          ensureCRDT()
          const answer = await manualCollaboration.acceptOfferToken(offer)
          await copyOrPrompt('Answer token — send this back to the first device:', answer)
          editor.setStatusMessage('Cross-device answer token created.')
        },
      },
      {
        id: 'priority2:collaboration-apply-answer',
        label: 'Collaboration: Apply Cross-Device Answer',
        description: 'Completes the manual WebRTC handshake.',
        category: 'Collaboration',
        icon: '✅',
        keywords: ['webrtc', 'manual', 'answer', 'connect'],
        handler: async () => {
          const answer = prompt('Paste the answer token from the second device:')?.trim()
          if (!answer) return
          await manualCollaboration.applyAnswerToken(answer)
          editor.setStatusMessage('Answer applied. Waiting for WebRTC connection.')
        },
      },
      {
        id: 'priority2:collaboration-disconnect',
        label: 'Collaboration: Disconnect Cross-Device Session',
        category: 'Collaboration',
        icon: '⛓',
        keywords: ['webrtc', 'disconnect', 'peer'],
        handler: () => manualCollaboration.close(),
      },
      {
        id: 'priority2:vcs-merge',
        label: 'Version Control: Merge Branch into Current',
        description: 'Performs a three-way local branch merge with conflict detection.',
        category: 'Version Control',
        icon: '⑂',
        keywords: ['merge', 'branch', 'conflict', 'git'],
        handler: mergeBranchIntoCurrent,
      },
      {
        id: 'priority2:binary-save',
        label: 'Storage: Save Deduplicated Binary Snapshot',
        category: 'Storage',
        icon: '▦',
        keywords: ['binary', 'blocks', 'deduplicate', 'snapshot'],
        handler: async () => {
          await saveBinarySnapshot()
          editor.setStatusMessage('Deduplicated binary snapshot saved.')
        },
      },
      {
        id: 'priority2:workers-health',
        label: 'System: Run Priority 2 Worker Health Check',
        category: 'System',
        icon: '⚙',
        keywords: ['worker', 'thread', 'health', 'test'],
        handler: runWorkerHealthCheck,
      },
    ])
  }

  function registerExportCommand(format: ExportFormat, label: string, icon: string): void {
    commandRegistry.register({
      id: `priority2:export-${String(format)}`,
      label,
      category: 'Export',
      icon,
      keywords: ['export', String(format), 'download'],
      handler: () => {
        exportStore.setFormat(format)
        exportStore.openDialog()
      },
    })
  }

  async function mergeBranchIntoCurrent(): Promise<void> {
    const repository = versionControlService.getRepository()
    const current = versionStore.currentBranch
    if (!repository || !current) {
      editor.setStatusMessage('Create or open a project before merging.')
      return
    }
    const candidates = repository.branches.filter((branch) => branch.id !== current.id)
    if (candidates.length === 0) {
      editor.setStatusMessage('Create another branch before merging.')
      return
    }
    const sourceName = prompt(`Merge which branch into ${current.name}?\n${candidates.map((branch) => branch.name).join(', ')}`)?.trim()
    if (!sourceName) return
    const source = candidates.find((branch) => branch.name === sourceName)
    if (!source) {
      editor.setStatusMessage(`Branch not found: ${sourceName}`)
      return
    }

    const result = await persistentVersionControl.merge(repository, source.id, current.id, {
      strategy: 'ours',
      priorMerges: repositoryMerges,
    })
    const saved = await persistentVersionControl.load(repository.projectId)
    repositoryMerges = saved?.merges ?? repositoryMerges
    versionControlService.hydrate(result.repository)
    versionStore.sync()
    suppressHistoryWatch = true
    scene._setAllRaw(normalizeHierarchy(clone(result.snapshot.objects)))
    await nextTick()
    suppressHistoryWatch = false
    editor.setStatusMessage(
      result.conflicts.length
        ? `Merged ${source.name} with ${result.conflicts.length} conflict(s), resolved using current branch.`
        : `Merged ${source.name} into ${current.name}.`,
    )
  }

  async function runWorkerHealthCheck(): Promise<void> {
    if (!workers.available) {
      editor.setStatusMessage('Web Workers are unavailable in this browser.')
      return
    }
    const [historyResult, aiResult, exportResult] = await Promise.all([
      workers.compareHistory([], scene.objects),
      workers.parseAIInstruction('create 2 rectangles'),
      workers.serializeScene(project.activeProjectName, scene.objects),
    ])
    editor.setStatusMessage(
      `Workers ready: history=${historyResult.changed}, AI ops=${aiResult.operations.length}, export=${exportResult.bytes} B.`,
    )
  }

  function ensureCRDT(): void {
    if (!crdtService.isInitialized) crdtService.create(project.activeProjectName)
  }
})

function extendedFormat(format: 'html' | 'zip'): ExportFormat {
  return format as unknown as ExportFormat
}

async function copyOrPrompt(message: string, value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    alert(`${message}\n\nThe token has been copied to your clipboard.`)
  } catch {
    prompt(message, value)
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
