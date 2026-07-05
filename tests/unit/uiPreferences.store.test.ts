// tests/unit/uiPreferences.store.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUIPreferencesStore } from '~/stores/uiPreferences'

const STORAGE_KEY = 'collab-ide:ui-preferences'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('uiPreferences store', () => {
  it('defaults to dark theme, expanded sidebar, and normal motion', () => {
    const prefs = useUIPreferencesStore()
    expect(prefs.themeMode).toBe('dark')
    expect(prefs.sidebarCollapsed).toBe(false)
    expect(prefs.reducedMotion).toBe(false)
  })

  it('setThemeMode updates state and persists to localStorage', () => {
    const prefs = useUIPreferencesStore()
    prefs.setThemeMode('light')
    expect(prefs.themeMode).toBe('light')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).themeMode).toBe('light')
  })

  it('rehydrates persisted preferences on next store creation', () => {
    const prefs = useUIPreferencesStore()
    prefs.setThemeMode('light')
    prefs.setSidebarCollapsed(true)

    // Simulate a fresh app load: new Pinia instance, same localStorage.
    setActivePinia(createPinia())
    const reloaded = useUIPreferencesStore()
    expect(reloaded.themeMode).toBe('light')
    expect(reloaded.sidebarCollapsed).toBe(true)
  })

  it('hydrateFromStorage recovers a persisted preference even if state() itself missed it (SSR payload case)', () => {
    // Simulates the real bug: server-rendered state() runs without
    // localStorage and defaults to 'dark'; the client then rehydrates from
    // that serialized 'dark' state instead of re-running state(). Only an
    // explicit, client-only re-read (hydrateFromStorage) can recover it.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeMode: 'light', sidebarCollapsed: true, reducedMotion: true }))
    const prefs = useUIPreferencesStore()
    prefs.$patch({ themeMode: 'dark', sidebarCollapsed: false, reducedMotion: false })

    prefs.hydrateFromStorage()

    expect(prefs.themeMode).toBe('light')
    expect(prefs.sidebarCollapsed).toBe(true)
    expect(prefs.reducedMotion).toBe(true)
  })

  it('resolvedTheme returns themeMode directly for light/dark', () => {
    const prefs = useUIPreferencesStore()
    prefs.setThemeMode('light')
    expect(prefs.resolvedTheme).toBe('light')
    prefs.setThemeMode('dark')
    expect(prefs.resolvedTheme).toBe('dark')
  })

  it('resolvedTheme resolves "system" to dark when the OS prefers dark', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const prefs = useUIPreferencesStore()
    prefs.setThemeMode('system')
    expect(prefs.resolvedTheme).toBe('dark')
    vi.unstubAllGlobals()
  })

  it('resolvedTheme resolves "system" to light when the OS prefers light', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    const prefs = useUIPreferencesStore()
    prefs.setThemeMode('system')
    expect(prefs.resolvedTheme).toBe('light')
    vi.unstubAllGlobals()
  })

  it('toggleSidebar flips sidebarCollapsed', () => {
    const prefs = useUIPreferencesStore()
    expect(prefs.sidebarCollapsed).toBe(false)
    prefs.toggleSidebar()
    expect(prefs.sidebarCollapsed).toBe(true)
    prefs.toggleSidebar()
    expect(prefs.sidebarCollapsed).toBe(false)
  })

  it('resetPreferences restores every default and persists it', () => {
    const prefs = useUIPreferencesStore()
    prefs.setThemeMode('light')
    prefs.setSidebarCollapsed(true)
    prefs.setReducedMotion(true)

    prefs.resetPreferences()

    expect(prefs.themeMode).toBe('dark')
    expect(prefs.sidebarCollapsed).toBe(false)
    expect(prefs.reducedMotion).toBe(false)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      themeMode: 'dark',
      sidebarCollapsed: false,
      reducedMotion: false,
    })
  })
})
