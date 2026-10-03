import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-End-Tests.
 *
 * Sie laufen gegen die **gebaute** Fassung und nicht gegen den Entwicklungsserver:
 * Service Worker, Precache und Manifest verhalten sich nur dort wie im Betrieb.
 *
 * **Zu den Projekten.** Ein Geraetedeskriptor emuliert Viewport, User-Agent, Touch
 * und Pixeldichte – nicht das Plattformverhalten von iOS. Die iPhone- und
 * iPad-Deskriptoren tragen `defaultBrowserType: 'webkit'`, Playwright startet
 * dafuer also seinen WebKit-Build (nicht Safari). In CI laufen alle sieben
 * Projekte, Chromium und WebKit (seit 03.10.2026). Lokal vor dem ersten Lauf:
 *
 *   npm run e2e:browser
 *
 * **Service Worker gibt es nur in Chromium.** Playwright haelt das in den
 * Typdefinitionen ausdruecklich fest. Die PWA-Tests liegen deshalb in einer
 * eigenen Datei, die alle Nicht-Chromium-Projekte ueber `testIgnore` auslassen –
 * sonst waeren sie in vier von sieben Projekten rot, ohne dass etwas kaputt ist.
 */

/**
 * Tests, die einen Chromium-Unterbau brauchen (Service Worker, Manifest-Pruefung):
 * `pwa.spec.ts` und jede `*.pwa.spec.ts`. Bis zum 03.10.2026 lautete das Muster
 * `/\.pwa\.spec\.ts$/` und erfasste die vorhandene Datei `pwa.spec.ts` nicht – vor
 * „pwa" steht dort ein `/`, kein Punkt. Die PWA-Tests waeren im CI damit auch in
 * den vier WebKit-Projekten gelaufen (nachgeprueft mit `playwright test --list`).
 */
const NUR_CHROMIUM = /(^|[/\\.])pwa\.spec\.ts$/

const istCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: istCi,
  retries: istCi ? 1 : 0,
  // In CI: Anmerkungen direkt am Commit (`github`) und ein HTML-Bericht, den der
  // Workflow bei einem Fehlschlag als Artefakt hochlaedt. Lokal die Liste.
  reporter: istCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !istCi,
    timeout: 180_000,
  },
  // Mobile-First: nach Breite aufsteigend, das schmalste Geraet zuerst (A2).
  projects: [
    // --- Telefone ---
    // 360 px – das schmalste Geraet im Satz. Hier brechen Tap-Ziele und
    // Beschriftungen zuerst; der wichtigste Lauf ueberhaupt.
    { name: 'android-schmal', use: { ...devices['Galaxy S24'] } },
    // 375 px
    {
      name: 'ios-schmal',
      use: { ...devices['iPhone SE (3rd gen)'] },
      testIgnore: NUR_CHROMIUM,
    },
    // 402 px
    { name: 'ios-telefon', use: { ...devices['iPhone 17'] }, testIgnore: NUR_CHROMIUM },
    // 448 px – breitestes Telefon
    { name: 'android-breit', use: { ...devices['Pixel 10 Pro XL'] } },

    // --- Tablet und Desktop (nachrangig, A2) ---
    { name: 'ios-tablet', use: { ...devices['iPad Pro 11'] }, testIgnore: NUR_CHROMIUM },
    {
      name: 'ios-tablet-quer',
      use: { ...devices['iPad (gen 11) landscape'] },
      testIgnore: NUR_CHROMIUM,
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
})
