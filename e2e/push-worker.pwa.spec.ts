import { expect, test, type Page } from '@playwright/test'

/**
 * Push-Ereignis im echten Service Worker (C9, 8.2): Zustellung ueber CDP (`ServiceWorker.deliverPushMessage`), danach
 * `registration.getNotifications()`.
 *
 * **Neuer Headless-Modus noetig** (`channel: 'chromium'`): Die Headless-Shell, die Playwright sonst startet, verweigert
 * die Berechtigung fuer Benachrichtigungen trotz `grantPermissions` (im Zeitkasten vom 25.10.2026 nachgemessen:
 * `Notification.permission` blieb `denied`). `playwright install chromium` bringt beide Fassungen mit. Eigene Datei, weil `channel` nur auf oberster Ebene einer
 * Datei gesetzt werden kann (er erzwingt einen eigenen Worker). Das Antippen (`notificationclick`) ist nicht
 * nachbildbar und bleibt Handpruefung (Abnahme 3).
 */
test.use({ channel: 'chromium' })

test.describe('Push im Service Worker', () => {
  /**
   * Liefert eine Nutzlast an den Worker der Seite.
   *
   * Die Registrierung wird ueber ihren Geltungsbereich gewaehlt, nicht als erste Meldung: `ServiceWorker.enable` meldet
   * auch geloeschte oder fremde Registrierungen (unter Last gesehen: die Zustellung ging ins Leere).
   */
  async function zustellen(page: Page, nutzlast: unknown) {
    const cdp = await page.context().newCDPSession(page)
    const ursprung = new URL(page.url()).origin
    const registrierungen: { registrationId: string; scopeURL: string; isDeleted: boolean }[] = []
    cdp.on(
      'ServiceWorker.workerRegistrationUpdated',
      (e: { registrations: { registrationId: string; scopeURL: string; isDeleted: boolean }[] }) =>
        registrierungen.push(...e.registrations),
    )
    await cdp.send('ServiceWorker.enable')
    const passend = () => registrierungen.filter((r) => !r.isDeleted && r.scopeURL === `${ursprung}/`).at(-1)
    await expect.poll(() => passend() !== undefined).toBe(true)
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin: ursprung,
      registrationId: passend()!.registrationId,
      data: typeof nutzlast === 'string' ? nutzlast : JSON.stringify(nutzlast),
    })
  }

  async function angezeigt(page: Page) {
    return page.evaluate(async () =>
      (await (await navigator.serviceWorker.getRegistration())!.getNotifications()).map((n) => ({
        titel: n.title,
        text: n.body,
        tag: n.tag,
        url: (n.data as { url?: string } | null)?.url,
      })),
    )
  }

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['notifications'])
    await page.goto('/')
    await expect
      .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)), {
        timeout: 15_000,
      })
      .toBe(true)
  })

  test('Erinnerung, dann Absage desselben Termins: eine Benachrichtigung, die Absage ersetzt die Erinnerung (tag)', async ({
    page,
  }) => {
    const termin = { terminId: 42, datum: '2026-11-02', uhrzeit: '19:00:00', ort: null, url: '/termine/42' }
    await zustellen(page, { typ: 'ERINNERUNG', titel: 'Rueckfall', text: 'Rueckfall', ...termin })
    await expect
      .poll(() => angezeigt(page), { timeout: 15_000 })
      .toEqual([
        { titel: 'Kicken am Montag, 19:00 Uhr', text: 'Bitte gib Bescheid, ob du dabei bist.', tag: 'termin-42', url: '/termine/42' },
      ])

    await zustellen(page, { typ: 'TERMIN_ABGESAGT', titel: 'Rueckfall', text: 'Rueckfall', ...termin })
    await expect
      .poll(() => angezeigt(page), { timeout: 15_000 })
      .toEqual([{ titel: 'Kicken am Montag fällt aus', text: 'Der Termin wurde abgesagt.', tag: 'termin-42', url: '/termine/42' }])
  })

  test('kaputte Nutzlast: trotzdem eine Benachrichtigung (userVisibleOnly)', async ({ page }) => {
    await zustellen(page, 'kein JSON')
    await expect.poll(() => angezeigt(page), { timeout: 15_000 }).toEqual([
      { titel: 'Neue Nachricht', text: 'Öffne die App für Einzelheiten.', tag: '', url: '/' },
    ])
  })

  test('Probe: eigener Titel ohne Anwendungsnamen', async ({ page }) => {
    await zustellen(page, {
      typ: 'PROBE',
      titel: 'FuBo – Testbenachrichtigung',
      text: 'Der Versand über diesen Server funktioniert auf diesem Gerät.',
      url: '/',
    })
    await expect.poll(async () => (await angezeigt(page)).map((n) => n.titel), { timeout: 15_000 }).toEqual(['Testbenachrichtigung'])
  })
})
