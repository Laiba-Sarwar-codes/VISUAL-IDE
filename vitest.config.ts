// vitest.config.ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/component/**/*.test.ts',
    ],
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      '.nuxt/**',
    ],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      // Map ~~/src to src/ so test files can import with same paths as app
      '~~/src': resolve(__dirname, 'src'),
      '~/stores': resolve(__dirname, 'app/stores'),
      '~/composables': resolve(__dirname, 'app/composables'),
      '~/components': resolve(__dirname, 'app/components'),
      '#app': resolve(__dirname, 'node_modules/nuxt/dist/app'),
    },
  },
})