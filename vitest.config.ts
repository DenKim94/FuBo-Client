import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

/**
 * Testlauf fuer Unit- und Komponententests.
 * Uebernimmt die Vite-Konfiguration, damit Pfad-Aliase, SCSS und die virtuellen
 * PWA-Module auch im Test aufgeloest werden.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      // CSS-Modules-Klassennamen im Test aufloesen, sonst sind sie undefined.
      css: true,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['node_modules', 'dist', 'dev-dist', 'e2e'],
    },
  }),
)
