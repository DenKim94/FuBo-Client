import { expect, test, type Page } from '@playwright/test'
import { ueberhangHorizontal } from './hilfen/admin.js'
import { geraetProtokoll, pushGeraetNachbilden, pushNachbilden, type GeraetAnfang, type PushServer } from './hilfen/push.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'

/**
 * Push-Einstellungen, Start-Abgleich und Probeversand (C9, 8.2) gegen die gebaute Fassung.
 *
 * **Nur Chromium** (Endung `.pwa.spec.ts`): Service Worker und Push gibt es in Playwright nur dort. Die Push-API des
 * Browsers ist eine Attrappe (`pushGeraetNachbilden`), weil ein echtes `subscribe()` headless mangels Push-Dienst
 * scheitert; der Service Worker selbst ist echt registriert.
 */

async function start(
  page: Page,
  { rolle = 'USER', server = {}, geraet = {} }: { rolle?: 'USER' | 'ADMIN' | 'GAST'; server?: Partial<PushServer>; geraet?: GeraetAnfang } = {},
) {
  const sitzung = await sitzungNachbilden(page, { leerlaufSek: 900, rolle })
  const push = await pushNachbilden(page, server)
  await pushGeraetNachbilden(page, geraet)
  return { sitzung, push }
}

/** Wartet, bis der Service Worker aktiv ist (die Attrappe braucht `serviceWorker.ready`). */
async function workerBereit(page: Page) {
  await expect
    .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)), {
      timeout: 15_000,
    })
    .toBe(true)
}

test.describe('Einstellungen: Benachrichtigungen', () => {
  test('einrichten und entfernen: erst der Browser, dann der Server', async ({ page }) => {
    const { push } = await start(page)
    await page.goto('/einstellungen')
    await workerBereit(page)
    await expect(page.getByTestId('push-zustand-geraet-text')).toHaveText('Auf diesem Gerät nicht eingerichtet.')

    await page.getByTestId('push-einrichten').click()
    await expect(page.getByTestId('push-zustand-geraet-text')).toHaveText('Auf diesem Gerät eingerichtet.')
    await expect(page.getByTestId('push-zustand-geraet')).toBeFocused()
    expect(push.angelegt).toHaveLength(1)
    // Unveraendert gesendet: Grossbuchstaben und Unterstrich bleiben (P8).
    expect(push.angelegt[0].endpoint).toBe('https://push.example/E2E-Geraet_1')
    expect(push.angelegt[0].p256dh).toHaveLength(88)
    expect(push.angelegt[0].auth).toHaveLength(22)
    // Ein Klick, eine Anlage; ohne Hintergrundkopf (es ist eine Bedienung).
    expect(push.aufrufe.filter((a) => a.pfad === 'anlegen')).toEqual([{ pfad: 'anlegen', keinRefresh: undefined }])
    expect((await geraetProtokoll(page)).aufrufe.slice(0, 2)).toEqual(['erfragen', 'abonnieren'])

    // Beim Entfernen ist das Browser-Abonnement schon gekuendigt, wenn der Server gefragt wird (E27).
    let browserSchonGekuendigt: boolean | null = null
    await page.route('**/api/v1/push/abo/entfernen', async (route) => {
      browserSchonGekuendigt = (await geraetProtokoll(page)).abo === null
      push.entfernt.push((route.request().postDataJSON() as { endpoint: string }).endpoint)
      return route.fulfill({ json: { aboVorhanden: false } })
    })
    await page.getByTestId('push-entfernen').click()
    await expect(page.getByTestId('push-zustand-geraet-text')).toHaveText('Auf diesem Gerät nicht eingerichtet.')
    expect(browserSchonGekuendigt).toBe(true)
    expect(push.entfernt).toEqual(['https://push.example/E2E-Geraet_1'])
  })

  test('Berechtigung blockiert: Text ohne Knopf', async ({ page }) => {
    await start(page, { geraet: { berechtigung: 'denied' } })
    await page.goto('/einstellungen')
    await expect(page.getByTestId('push-zustand-geraet-text')).toContainText('Im Browser blockiert')
    await expect(page.getByTestId('push-einrichten')).toHaveCount(0)
    await expect(page.getByTestId('push-entfernen')).toHaveCount(0)
  })

  test('Personenschalter: Hinweis beim Abschalten, gespeicherter Stand', async ({ page }) => {
    const { push } = await start(page)
    await page.goto('/einstellungen')
    const schalter = page.getByTestId('push-schalter')
    await expect(schalter).toHaveAttribute('aria-checked', 'true')
    await schalter.click()
    await expect(page.getByTestId('push-abschalt-hinweis')).toBeVisible()
    await expect(schalter).toHaveAttribute('aria-checked', 'false')
    expect(push.pushErwuenscht).toBe(false)
    await schalter.click()
    await expect(page.getByTestId('push-abschalt-hinweis')).toHaveCount(0)
  })

  test('Server ohne VAPID: Bereich ohne Bedienelemente', async ({ page }) => {
    await start(page, { server: { eingerichtet: false } })
    await page.goto('/einstellungen')
    await expect(page.getByTestId('push-nicht-eingerichtet')).toBeVisible()
    await expect(page.getByTestId('push-schalter')).toHaveCount(0)
    await expect(page.getByTestId('push-einrichten')).toHaveCount(0)
  })

  test('Weg ueber das Symbol in der Kopfzeile und zurueck', async ({ page }) => {
    await start(page)
    await page.goto('/')
    await page.getByTestId('layout-einstellungen').click()
    await expect(page).toHaveURL(/\/einstellungen$/)
    await expect(page.getByTestId('layout-einstellungen')).toHaveCount(0)
    await page.getByTestId('layout-zurueck').click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('Start-Abgleich (E29)', () => {
  test('vorhandenes Abonnement: genau eine Anmeldung je Seitenaufruf, mit X-FuBo-Kein-Refresh (G1)', async ({ page }) => {
    const { push, sitzung } = await start(page, {
      geraet: { berechtigung: 'granted', abonnement: 'https://push.example/E2E-Vorhanden' },
    })
    // Ein Geraet mit Abonnement hat seinen Worker schon registriert. Im frischen Testkontext entsteht er erst beim ersten
    // Laden; ob der Abgleich ihn da schon sieht, ist Zufall. Gezaehlt wird deshalb ab dem ersten Neuladen.
    await page.goto('/')
    await workerBereit(page)
    const anlegen = () => push.aufrufe.filter((a) => a.pfad === 'anlegen').length
    await page.waitForLoadState('networkidle')
    const anfang = anlegen()
    const verlaengernd = sitzung.verlaengernd

    await page.reload()
    await expect.poll(anlegen, { timeout: 15_000 }).toBe(anfang + 1)
    await page.reload()
    await expect.poll(anlegen, { timeout: 15_000 }).toBe(anfang + 2)
    // Ein weiteres Mal kommt nicht (kein Polling, StrictMode-Schutz).
    await page.waitForTimeout(500)
    expect(anlegen()).toBe(anfang + 2)
    // Schluessel und Anlage tragen den Kopf: Der Abgleich verlaengert die Sitzung nicht.
    for (const aufruf of push.aufrufe.filter((a) => a.pfad === 'anlegen' || a.pfad === 'schluessel')) {
      expect(aufruf.keinRefresh).toBe('true')
    }
    expect(push.angelegt.every((a) => a.endpoint === 'https://push.example/E2E-Vorhanden')).toBe(true)
    // Jedes Neuladen liest die Sitzung einmal verlaengernd (Bedienung), der Abgleich nicht.
    expect(sitzung.verlaengernd).toBe(verlaengernd + 2)
  })

  test('ohne Abonnement kein Aufruf', async ({ page }) => {
    const { push } = await start(page, { geraet: { berechtigung: 'granted' } })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    expect(push.aufrufe).toEqual([])
  })
})

test.describe('Rollen', () => {
  test('ADMIN: Probeversand ohne Koerper, Ergebnis und Anlagenschalter daneben', async ({ page }) => {
    const { push } = await start(page, {
      rolle: 'ADMIN',
      server: { anlageAktiv: false, endpunkte: new Set(['https://push.example/a']) },
    })
    await page.goto('/einstellungen')
    await expect(page.getByTestId('push-schalter')).toHaveCount(0)
    await expect(page.getByTestId('probe-anlage')).toContainText('abgeschaltet')
    await page.getByTestId('probe-senden').click()
    await expect(page.getByTestId('probe-ergebnis')).toHaveText('An 1 Gerät gesendet, 1 vom Push-Dienst angenommen.')
    expect(push.probe).toHaveLength(1)
    expect(push.probe[0].inhaltstyp).toBeUndefined()
    expect(push.probe[0].koerper ?? '').toBe('')
  })

  test('GAST: kein Symbol, kein Push-Aufruf, Einstellungen nur mit Satz (G6)', async ({ page }) => {
    const { push } = await start(page, {
      rolle: 'GAST',
      geraet: { berechtigung: 'granted', abonnement: 'https://push.example/E2E-Gast' },
    })
    await page.goto('/')
    await expect(page.getByTestId('layout-abmelden')).toBeVisible()
    await expect(page.getByTestId('layout-einstellungen')).toHaveCount(0)
    await page.goto('/einstellungen')
    await expect(page.getByTestId('einstellungen-gast')).toHaveText('Für Gäste gibt es keine Einstellungen.')
    await page.waitForLoadState('networkidle')
    expect(push.aufrufe).toEqual([])
  })
})

test.describe('Layout der Einstellungen bei 360 Pixel Breite', () => {
  for (const hoehe of [780, 640]) {
    test(`USER: kein seitliches Scrollen, Tap-Ziele mindestens 44 px (Hoehe ${String(hoehe)})`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: hoehe })
      await start(page)
      for (const pfad of ['/', '/einstellungen']) {
        await page.goto(pfad)
        await page.waitForLoadState('networkidle')
        expect(await ueberhangHorizontal(page), pfad).toBeLessThanOrEqual(0)
      }
      await expect(page.getByTestId('push-einrichten')).toBeVisible()
      const ziele = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('header a[href], header button, main button')]
          .filter((e) => e.getBoundingClientRect().height > 0)
          .map((e) => ({ id: e.getAttribute('data-testid'), b: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height })),
      )
      for (const ziel of ziele) {
        expect(ziel.h, ziel.id ?? '').toBeGreaterThanOrEqual(43.5)
        expect(ziel.b, ziel.id ?? '').toBeGreaterThanOrEqual(43.5)
      }
    })
  }

  test('Kopfzeile mit Zurueck, Einstellungen und Abmelden passt bei 360 px', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await start(page)
    // Eine Unterseite mit allen drei Elementen; der Termin fehlt (nicht gefunden), die Kopfzeile ist dieselbe.
    await page.goto('/termine/1')
    const zurueck = await page.getByTestId('layout-zurueck').boundingBox()
    const einstellungen = await page.getByTestId('layout-einstellungen').boundingBox()
    const abmelden = await page.getByTestId('layout-abmelden').boundingBox()
    expect(zurueck!.x + zurueck!.width).toBeLessThan(einstellungen!.x)
    expect(einstellungen!.x + einstellungen!.width).toBeLessThan(abmelden!.x)
    expect(Math.abs(einstellungen!.y + einstellungen!.height / 2 - (abmelden!.y + abmelden!.height / 2))).toBeLessThanOrEqual(1)
    expect(await ueberhangHorizontal(page)).toBeLessThanOrEqual(0)
  })
})
