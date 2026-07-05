// app/composables/useMonitoring.ts
// Module 21 — keyboard shortcut + command palette integration

import { onMounted, onUnmounted } from 'vue'
import { useMonitoringStore } from '~/stores/monitoring'
import { commandRegistry } from '~~/src/commands/CommandRegistry'

export function useMonitoring() {
  const mon = useMonitoringStore()

  function handleKeyDown(e: KeyboardEvent): void {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const meta = isMac ? e.metaKey : e.ctrlKey
    if (meta && e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault()
      mon.toggle()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)

    commandRegistry.register({
      id: 'monitoring:toggle',
      label: 'Toggle Monitoring Dashboard',
      category: 'Developer',
      icon: '⚡',
      keywords: ['monitor', 'fps', 'memory', 'debug', 'performance', 'dev'],
      shortcut: 'Cmd+Shift+M',
      handler: () => mon.toggle(),
    })
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return { mon }
}