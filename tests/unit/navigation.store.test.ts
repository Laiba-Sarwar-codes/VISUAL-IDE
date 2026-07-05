// tests/unit/navigation.store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNavigationStore } from '~/stores/navigation'
import { useAIWorkflowStore } from '~/stores/aiWorkflow'
import { useMonitoringStore } from '~/stores/monitoring'
import { useVersionControlStore } from '~/stores/versionControl'
import { useExportStore } from '~/stores/export'
import { useCollaborationUIStore } from '~/stores/collaborationUI'
import { usePluginUIStore } from '~/stores/pluginUI'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('navigation store', () => {
  it('defaults to canvas when nothing else is open', () => {
    const nav = useNavigationStore()
    expect(nav.activeScreen).toBe('canvas')
  })

  it('activeScreen is derived from each feature store\'s own boolean, not independent state', () => {
    const nav = useNavigationStore()
    const ai = useAIWorkflowStore()

    ai.open()
    expect(nav.activeScreen).toBe('ai-workflow')

    // Closing via the feature store's own action (not navigation.closeAll())
    // must be enough to fall back to canvas — proves there is no separate
    // "activeScreen" state that could go stale.
    ai.close()
    expect(nav.activeScreen).toBe('canvas')
  })

  it('openScreen closes any other open screen before opening the target', () => {
    const nav = useNavigationStore()
    const ai = useAIWorkflowStore()
    const mon = useMonitoringStore()

    nav.openScreen('ai-workflow')
    expect(ai.isOpen).toBe(true)
    expect(nav.activeScreen).toBe('ai-workflow')

    nav.openScreen('monitoring')
    expect(ai.isOpen).toBe(false)
    expect(mon.isOpen).toBe(true)
    expect(nav.activeScreen).toBe('monitoring')
  })

  it('openScreen(history) and openScreen(settings) use navigation\'s own booleans', () => {
    const nav = useNavigationStore()
    nav.openScreen('history')
    expect(nav.activeScreen).toBe('history')
    nav.openScreen('settings')
    expect(nav.activeScreen).toBe('settings')
  })

  it('goToCanvas closes every feature store', () => {
    const nav = useNavigationStore()
    const vc = useVersionControlStore()
    const exportStore = useExportStore()
    const collabUI = useCollaborationUIStore()
    const pluginUI = usePluginUIStore()

    vc.openPanel()
    exportStore.openDialog()
    collabUI.open()
    pluginUI.open()
    nav.historyOpen = true
    nav.settingsOpen = true

    nav.goToCanvas()

    expect(vc.isPanelOpen).toBe(false)
    expect(exportStore.isDialogOpen).toBe(false)
    expect(collabUI.isOpen).toBe(false)
    expect(pluginUI.isOpen).toBe(false)
    expect(nav.historyOpen).toBe(false)
    expect(nav.settingsOpen).toBe(false)
    expect(nav.activeScreen).toBe('canvas')
  })

  it('openScreen(canvas) is equivalent to closing everything', () => {
    const nav = useNavigationStore()
    const ai = useAIWorkflowStore()
    ai.open()
    nav.openScreen('canvas')
    expect(ai.isOpen).toBe(false)
    expect(nav.activeScreen).toBe('canvas')
  })
})
