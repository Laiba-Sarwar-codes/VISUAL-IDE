// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  nitro: {
    experimental: {
      websocket: true,
    },
  },

  modules: ['@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
    tsConfig: {
      include: [
        '../src/**/*',
        '../app/**/*',
      ],
    },
  },

  app: {
    head: {
      title: 'Collab Visual IDE',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0d0d0d' },
        { name: 'description', content: 'Browser-only collaborative visual editor' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'CollabIDE' },
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/favicon.ico' },
      ],
      // Theme-flash prevention: reads the persisted theme preference and
      // sets data-theme on <html> synchronously, before Vue hydrates and
      // before first paint. Mirrors the resolution logic in
      // app/stores/uiPreferences.ts (resolvedTheme getter) and
      // app/composables/useTheme.ts — kept in sync manually since this
      // runs outside the Vue app entirely.
      script: [
        {
          innerHTML: `(function(){try{var raw=localStorage.getItem('collab-ide:ui-preferences');var mode=raw?(JSON.parse(raw).themeMode):null;var resolved=mode;if(mode==='system'||!mode){resolved=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':(mode==='system'?'light':'dark');}document.documentElement.dataset.theme=resolved;}catch(e){document.documentElement.dataset.theme='dark';}})();`,
          type: 'text/javascript',
        },
      ],
    },
  },
})