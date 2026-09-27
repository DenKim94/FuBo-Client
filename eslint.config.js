import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    'coverage',
    'playwright-report',
    'test-results',
    // Erzeugt aus fubo-api.json und nie von Hand bearbeitet. Der Kontrakt
    // enthaelt in seinen Beschreibungstexten geschuetzte Leerzeichen, die
    // `no-irregular-whitespace` melden wuerde; eine Korrektur waere beim
    // naechsten `npm run api:typen` wieder weg.
    'src/api/common/types/schema.d.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // Der Service Worker laeuft in ServiceWorkerGlobalScope, nicht im Fenster.
    files: ['src/sw.ts'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Testdateien und Konfigurationen sehen Browser- und Node-Globals.
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.ts', 'e2e/**/*.ts', '*.config.ts'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
