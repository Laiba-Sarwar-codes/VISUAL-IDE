// app/stores/uiPreferences.ts
// UI redesign — presentation-only preferences (theme, sidebar collapsed
// state, reduced motion). Persisted to localStorage directly, never to
// project/scene data or IndexedDB — these are not part of the project
// file format and must survive independently of which project is open.

import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

interface UIPreferencesState {
  themeMode: ThemeMode
  sidebarCollapsed: boolean
  reducedMotion: boolean
}

const STORAGE_KEY = 'collab-ide:ui-preferences'

function loadPersisted(): Partial<UIPreferencesState> {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<UIPreferencesState>) : {}
  } catch {
    return {}
  }
}

function persist(state: UIPreferencesState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable/full — the preference just won't persist this session.
  }
}

export const useUIPreferencesStore = defineStore('uiPreferences', {
  state: (): UIPreferencesState => {
    const persisted = loadPersisted()
    return {
      // Defaults to 'dark' (not 'system') so existing users see the exact
      // same appearance as before this redesign unless they opt in.
      themeMode: persisted.themeMode ?? 'dark',
      sidebarCollapsed: persisted.sidebarCollapsed ?? false,
      reducedMotion: persisted.reducedMotion ?? false,
    }
  },

  getters: {
    resolvedTheme(state): 'light' | 'dark' {
      if (state.themeMode === 'system') {
        if (typeof window !== 'undefined' && window.matchMedia) {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
        return 'dark'
      }
      return state.themeMode
    },
  },

  actions: {
    setThemeMode(mode: ThemeMode): void {
      this.themeMode = mode
      persist(this.$state)
    },
    toggleSidebar(): void {
      this.sidebarCollapsed = !this.sidebarCollapsed
      persist(this.$state)
    },
    setSidebarCollapsed(value: boolean): void {
      this.sidebarCollapsed = value
      persist(this.$state)
    },
    setReducedMotion(value: boolean): void {
      this.reducedMotion = value
      persist(this.$state)
    },
    resetPreferences(): void {
      this.themeMode = 'dark'
      this.sidebarCollapsed = false
      this.reducedMotion = false
      persist(this.$state)
    },
    /**
     * Re-reads localStorage into state. Needed because Nuxt SSR serializes
     * this store's state (computed server-side, where localStorage doesn't
     * exist, so it's always the 'dark' default) into the payload, and the
     * client rehydrates from that payload instead of re-running state() —
     * so without this, a persisted 'light'/'system' choice would silently
     * revert to 'dark' on every full page reload. Called once, client-only,
     * from useTheme.ts's onMounted (which only ever runs in the browser).
     */
    hydrateFromStorage(): void {
      const persisted = loadPersisted()
      if (persisted.themeMode !== undefined) this.themeMode = persisted.themeMode
      if (persisted.sidebarCollapsed !== undefined) this.sidebarCollapsed = persisted.sidebarCollapsed
      if (persisted.reducedMotion !== undefined) this.reducedMotion = persisted.reducedMotion
    },
  },
})
