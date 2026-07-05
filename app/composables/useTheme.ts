// app/composables/useTheme.ts
// UI redesign — applies the resolved theme as a `data-theme` attribute on
// <html>, which app/assets/css/main.css's `:root[data-theme="..."]`
// blocks key off. Called once at the app root (app.vue), matching every
// other one-shot lifecycle composable in this codebase.

import { onMounted, onUnmounted, watch } from 'vue'
import { useUIPreferencesStore } from '~/stores/uiPreferences'

export function useTheme(): void {
  const prefs = useUIPreferencesStore()

  function apply(): void {
    if (typeof document === 'undefined') return
    document.documentElement.dataset.theme = prefs.resolvedTheme
    document.documentElement.dataset.reducedMotion = prefs.reducedMotion ? 'true' : 'false'
  }

  let media: MediaQueryList | null = null
  function handleSystemChange(): void {
    if (prefs.themeMode === 'system') apply()
  }

  onMounted(() => {
    // Client-only: corrects for Nuxt SSR having serialized this store's
    // state from a localStorage-less server render (see hydrateFromStorage's
    // own comment in app/stores/uiPreferences.ts for why this is needed).
    prefs.hydrateFromStorage()
    apply()
    if (typeof window !== 'undefined' && window.matchMedia) {
      media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', handleSystemChange)
    }
  })

  onUnmounted(() => {
    media?.removeEventListener('change', handleSystemChange)
  })

  watch(() => [prefs.themeMode, prefs.reducedMotion], apply)
}
