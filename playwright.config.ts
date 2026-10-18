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

/**
 * **WebKit-Projekte sind seit dem 18.10.2026 abgeschaltet.** Im CI-Lauf vom
 * 17.10.2026 scheiterten dort Tests quer durch die Dateien (u. a. ging nach
 * `page.reload()` der Verlaufszustand verloren: `admin.spec.ts`, „uebersteht ein
 * Neuladen von Schritt 2"); in den drei Chromium-Projekten waren alle gruen. Die
 * Ursache ist **nicht geklaert** – offen ist, ob Playwrights WebKit-Build oder das
 * Verhalten von Safari betroffen ist. Bis dahin pruefen die iPhone- und
 * iPad-Faelle die Handpruefung auf einem echten Geraet.
 *
 * Wieder einschalten: `WEBKIT_E2E=1 npx playwright test` (lokal nach
 * `npm run e2e:browser`; im CI `webkit` wieder in `playwright install` aufnehmen).
 */
const WEBKIT_AKTIV = Boolean(process.env.WEBKIT_E2E)
const OHNE_WEBKIT = WEBKIT_AKTIV ? NUR_CHROMIUM : /.*/

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
      testIgnore: OHNE_WEBKIT,
    },
    // 402 px
    { name: 'ios-telefon', use: { ...devices['iPhone 17'] }, testIgnore: OHNE_WEBKIT },
    // 448 px – breitestes Telefon
    { name: 'android-breit', use: { ...devices['Pixel 10 Pro XL'] } },

    // --- Tablet und Desktop (nachrangig, A2) ---
    { name: 'ios-tablet', use: { ...devices['iPad Pro 11'] }, testIgnore: OHNE_WEBKIT },
    {
      name: 'ios-tablet-quer',
      use: { ...devices['iPad (gen 11) landscape'] },
      testIgnore: OHNE_WEBKIT,
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
})
