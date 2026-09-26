import { expect, test } from '@playwright/test'

/**
 * Sichert die drei Punkte ab, die im Betrieb stillschweigend brechen wuerden:
 * Registrierung des Service Workers, Erreichbarkeit des Manifests und der
 * Umstand, dass `sw.js` nicht von der SPA-Rueckfallregel als HTML ausgeliefert
 * wird (A25a, Auflagen fuer Cloudflare Pages).
 *
 * **Laeuft nur in Chromium-Projekten.** Playwright unterstuetzt Service Worker
 * nur dort; die Konfiguration schliesst diese Datei fuer alle WebKit-Projekte
 * ueber `testIgnore` aus. Das iOS-Verhalten – Installation ueber „Zum
 * Home-Bildschirm" als Voraussetzung fuer Web Push – laesst sich mit Playwright
 * grundsaetzlich nicht pruefen und bleibt eine Handpruefung auf einem Geraet.
 */
test.describe('PWA-Grundgeruest', () => {
  test('registriert einen Service Worker', async ({ page }) => {
    await page.goto('/')
    await expect
      .poll(
        async () =>
          page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())),
        { timeout: 15_000 },
      )
      .toBe(true)
  })

  test('liefert Manifest und Service Worker mit dem richtigen Inhaltstyp aus', async ({ page }) => {
    const manifest = await page.request.get('/manifest.webmanifest')
    expect(manifest.status()).toBe(200)
    const manifestInhalt = (await manifest.json()) as {
      name: string
      short_name: string
      display: string
      icons: Array<{ sizes: string; purpose?: string }>
    }
    expect(manifestInhalt.name).toBe('MONTAGS-KICKER')
    expect(manifestInhalt.display).toBe('standalone')

    // Der `short_name` steht unter dem Symbol auf dem Startbildschirm. Er ist
    // hier festgenagelt, weil zwei Vorgaben daran haengen: keine Erwaehnung des
    // Projektnamens "FuBo" in der Oberflaeche und hoechstens zwoelf Zeichen,
    // sonst kuerzt das Betriebssystem.
    expect(manifestInhalt.short_name).toBe('GUT-KICK')
    expect(manifestInhalt.short_name.length).toBeLessThanOrEqual(12)

    // Ohne eine 512er-Ikone mit `any` zaehlt Chrome die Anwendung nicht als
    // installierbar, und `beforeinstallprompt` feuert stillschweigend nicht.
    const hat512Any = manifestInhalt.icons.some(
      (i) => i.sizes === '512x512' && (i.purpose === undefined || i.purpose === 'any'),
    )
    const hat512Maskable = manifestInhalt.icons.some(
      (i) => i.sizes === '512x512' && i.purpose === 'maskable',
    )
    expect(hat512Any, '512er-Ikone mit purpose "any" fehlt').toBe(true)
    expect(hat512Maskable, 'maskierbare 512er-Ikone fehlt').toBe(true)

    const worker = await page.request.get('/sw.js')
    expect(worker.status()).toBe(200)
    // Ein "text/html" hier hiesse: die SPA-Rueckfallregel hat sw.js erfasst.
    expect(worker.headers()['content-type']).toContain('javascript')
  })
})
