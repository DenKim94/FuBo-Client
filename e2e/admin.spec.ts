import { expect, test, type Page, type Route } from '@playwright/test'
import { sitzungNachbilden, type Sitzung } from './hilfen/sitzung.js'

/**
 * Prueft Admin-Zugang, Passwort-Reset und Passwortwechsel im echten Browser (C4).
 *
 * Ohne Server: Sitzung und die vier neuen Endpunkte werden mit `page.route`
 * nachgebildet (`hilfen/sitzung.ts`). Geprueft wird, was die Unit-Tests nicht
 * sehen: der Weg ueber mehrere Ansichten mit echtem Router und Verlaufszustand,
 * Fokus, Tastaturtyp, Platz auf dem Telefon.
 *
 * **Verlaengernde Abrufe:** Jeder Abruf von `/auth/session/lesen` ohne
 * `X-FuBo-Kein-Refresh` verschiebt beim echten Server das Leerlauf-Fenster
 * (Falle aus C3). Die Nachbildung zaehlt sie (`Sitzung.verlaengernd`); wo keine
 * Stufe wechselt, darf die Ansicht keinen ausloesen.
 */

/** Problemantwort des Servers. */
function problem(route: Route, status: number, code: string, detail: string, zusatz = {}) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', status, code, detail, ...zusatz },
  })
}

/** Beobachtbarer Stand der nachgebildeten Admin-Endpunkte. */
type AdminServer = {
  sitzung: Sitzung
  /** Wie der naechste Aufruf von `/auth/admin/anmelden` ausgeht. */
  anmeldung: 'erfolg' | 'falsch' | 'gesperrt'
  /** Aufrufe von `/auth/passwort/zuruecksetzen`. */
  angefordert: number
  /** Antworten der naechsten Aufrufe von `/auth/passwort/bestaetigen`, von vorn verbraucht. */
  bestaetigungen: ('erfolg' | 'pin-falsch' | 'ungueltig')[]
}

/**
 * Bildet Sitzung, Namensliste und die Endpunkte der Admin-Anmeldung nach.
 *
 * @param start Anfangszustand der Sitzung.
 */
async function adminServer(page: Page, start: Partial<Sitzung> = {}): Promise<AdminServer> {
  const sitzung = await sitzungNachbilden(page, { leerlaufSek: 900, stage: 'PIN_VERIFIED', ...start })
  const server: AdminServer = {
    sitzung,
    anmeldung: 'erfolg',
    angefordert: 0,
    bestaetigungen: [],
  }

  await page.route('**/api/v1/auth/users/lesen', (route) =>
    route.fulfill({ json: [{ id: 11, name: 'Beispielspieler 01', belegt: false }] }),
  )
  await page.route('**/api/v1/auth/pin/pruefen', (route) => {
    sitzung.angemeldet = true
    sitzung.stage = 'PIN_VERIFIED'
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/auth/admin/anmelden', (route) => {
    if (server.anmeldung === 'falsch') {
      return problem(route, 401, 'ADMIN_PASSWORT_FALSCH', 'Anmeldename oder Passwort ist nicht korrekt.')
    }
    if (server.anmeldung === 'gesperrt') {
      return problem(route, 429, 'PIN_GESPERRT', 'Zu viele Fehlversuche. Bitte in 30 Sekunden erneut versuchen.', {
        wartesekunden: 30,
      })
    }
    sitzung.stage = 'PROFILE_AUTHENTICATED'
    sitzung.rolle = 'ADMIN'
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/auth/passwort/zuruecksetzen', (route) => {
    server.angefordert += 1
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/auth/passwort/bestaetigen', (route) => {
    const antwort = server.bestaetigungen.shift() ?? 'erfolg'
    if (antwort === 'pin-falsch') {
      return problem(route, 401, 'RESET_PIN_FALSCH', 'Die PIN ist nicht korrekt. Noch 4 Versuche.')
    }
    if (antwort === 'ungueltig') {
      return problem(route, 409, 'RESET_UNGUELTIG', 'Die PIN ist nicht mehr gültig. Bitte fordere eine neue an.')
    }
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/admin/passwort/aendern', (route) => {
    // Wie der Server: alle Adminsitzungen widerrufen.
    sitzung.angemeldet = false
    return route.fulfill({ status: 204 })
  })
  return server
}

/** Gibt die Hoehe zurueck, um die die Seite ueber das Fenster hinausragt (0 = kein Scrollen). */
async function ueberhang(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
  )
}

/** Wahr, wenn das Fenster hoch genug fuer die Kein-Scrollen-Pruefung ist (siehe `namensauswahl.spec.ts`). */
function genugHoch(page: Page) {
  const groesse = page.viewportSize()!
  return groesse.width < 600 && groesse.height >= 740
}

test.describe('Admin-Anmeldung', () => {
  test('fuehrt von der PIN ueber die Namensauswahl in die Administration', async ({ page }) => {
    const server = await adminServer(page, { angemeldet: false })
    await page.goto('/admin/anmelden')
    // Ohne Sitzung zuerst die PIN, dann die Namensauswahl; der Link dort ist der Einstieg.
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await page.getByTestId('pin-feld').fill('1234')
    await page.getByTestId('pin-absenden').click()
    await expect(page).toHaveURL(/\/anmelden$/)

    await page.getByTestId('namensauswahl-admin-link').click()
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
    await page.getByTestId('admin-name').fill('Beispieladmin')
    await page.getByTestId('admin-passwort').fill('beispiel-passwort-01')
    await page.getByTestId('admin-absenden').click()

    // Ziel nach der Admin-Anmeldung ist die Administration (E1), ohne „Zurueck".
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByTestId('platzhalter-c7')).toBeVisible()
    await expect(page.getByTestId('layout-zurueck')).toBeHidden()
    expect(server.sitzung.rolle).toBe('ADMIN')
  })

  test('zeigt bei falschem Passwort den Kasten, leert das Passwort und behaelt den Namen', async ({ page }) => {
    const server = await adminServer(page)
    server.anmeldung = 'falsch'
    await page.goto('/admin/anmelden')
    await page.getByTestId('admin-name').fill('Beispieladmin')
    await page.getByTestId('admin-passwort').fill('falsches-passwort')

    await page.getByTestId('admin-absenden').click()

    await expect(page.getByTestId('admin-fehler')).toHaveText(/Anmeldename oder Passwort ist nicht korrekt\./)
    await expect(page.getByTestId('admin-passwort')).toHaveValue('')
    await expect(page.getByTestId('admin-name')).toHaveValue('Beispieladmin')
    await expect(page.getByTestId('admin-passwort')).toBeFocused()
    // Ein falsches Passwort ist kein Sitzungsende.
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
  })

  test('sperrt bei 429 die Anmeldung fuer die Wartezeit', async ({ page }) => {
    const server = await adminServer(page)
    server.anmeldung = 'gesperrt'
    await page.goto('/admin/anmelden')
    await page.getByTestId('admin-name').fill('Beispieladmin')
    await page.getByTestId('admin-passwort').fill('beispiel-passwort-01')

    await page.getByTestId('admin-absenden').click()

    await expect(page.getByTestId('admin-fehler')).toHaveText(/Bitte in 30 Sekunden erneut versuchen\./)
    await expect(page.getByTestId('admin-absenden')).toBeDisabled()
  })

  test('verlangt am Namen keine automatische Grossschreibung', async ({ page }) => {
    // Der Server vergleicht den Namen zeichengenau; iOS schriebe das erste Zeichen gross.
    await adminServer(page)
    await page.goto('/admin/anmelden')
    await expect(page.getByTestId('admin-name')).toHaveAttribute('autocapitalize', 'none')
  })

  test('passt auf dem Telefon ohne Scrollen, auch mit Fehlermeldung', async ({ page }) => {
    test.skip(!genugHoch(page), 'Unter 740 px Fensterhoehe scrollen die Ansichten (Entscheidung C3).')
    const server = await adminServer(page)
    server.anmeldung = 'falsch'
    await page.goto('/admin/anmelden')
    expect(await ueberhang(page)).toBeLessThanOrEqual(0)

    await page.getByTestId('admin-name').fill('Beispieladmin')
    await page.getByTestId('admin-passwort').fill('falsches-passwort')
    await page.getByTestId('admin-absenden').click()
    await expect(page.getByTestId('admin-fehler')).toBeVisible()

    expect(await ueberhang(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('Passwort vergessen', () => {
  test('fuehrt durch beide Schritte bis zur Admin-Anmeldung mit Hinweis', async ({ page }) => {
    const server = await adminServer(page)
    server.bestaetigungen = ['pin-falsch', 'ungueltig', 'erfolg']
    await page.goto('/admin/anmelden')

    // Schritt 1
    await page.getByTestId('admin-passwort-vergessen-link').click()
    await expect(page).toHaveURL(/\/admin\/passwort\/vergessen$/)
    await expect(page.getByTestId('passwort-vergessen-schritt')).toHaveText('Schritt 1 von 2')
    await page.getByTestId('passwort-vergessen-absenden').click()

    // Schritt 2 mit Restgueltigkeit
    await expect(page).toHaveURL(/\/admin\/passwort\/neu$/)
    await expect(page.getByTestId('passwort-neu-balken')).toBeVisible()
    await expect(page.getByTestId('passwort-neu-gueltigkeit')).toHaveText(/^Gültig bis \d{2}:\d{2} Uhr\.$/)
    // Ab hier wechselt keine Stufe mehr: Kein Abruf darf das Fenster verlaengern.
    const verlaengernd = server.sitzung.verlaengernd

    // Falsche PIN: Text am Feld, PIN leer, Passwort bleibt, Fokus im PIN-Feld.
    await page.getByTestId('reset-pin-feld').fill('11111')
    await page.getByTestId('passwort-neu-passwort').fill('beispiel-passwort-02')
    await page.getByTestId('passwort-neu-absenden').click()
    await expect(page.getByTestId('reset-pin-feld-fehler')).toHaveText(/Noch 4 Versuche\./)
    await expect(page.getByTestId('reset-pin-feld')).toHaveValue('')
    await expect(page.getByTestId('passwort-neu-passwort')).toHaveValue('beispiel-passwort-02')
    await expect(page.getByTestId('reset-pin-feld')).toBeFocused()

    // Abgelaufene PIN: Kasten mit der Aktion „Neue PIN anfordern".
    await page.getByTestId('reset-pin-feld').fill('22222')
    await page.getByTestId('passwort-neu-absenden').click()
    await expect(page.getByTestId('passwort-neu-fehler')).toHaveText(/nicht mehr gültig/)
    await page.getByTestId('passwort-neu-neu-anfordern').click()
    await expect(page).toHaveURL(/\/admin\/passwort\/vergessen$/)
    await page.getByTestId('passwort-vergessen-absenden').click()
    await expect(page).toHaveURL(/\/admin\/passwort\/neu$/)
    expect(server.angefordert).toBe(2)

    // Erfolg: zurueck zur Admin-Anmeldung, mit Hinweis; die Sitzung bleibt PIN_VERIFIED.
    await page.getByTestId('reset-pin-feld').fill('33333')
    await page.getByTestId('passwort-neu-passwort').fill('beispiel-passwort-03')
    await page.getByTestId('passwort-neu-absenden').click()
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
    await expect(page.getByTestId('admin-hinweis')).toHaveText(
      /Passwort gesetzt\. Melde dich mit dem neuen Passwort an\./,
    )
    expect(server.sitzung.stage).toBe('PIN_VERIFIED')
    expect(server.sitzung.verlaengernd).toBe(verlaengernd)
  })

  test('erreicht Schritt 2 auch mit bereits vorhandener PIN, ohne Balken', async ({ page }) => {
    await adminServer(page)
    await page.goto('/admin/passwort/vergessen')

    await page.getByTestId('passwort-vergessen-pin-vorhanden-link').click()

    await expect(page).toHaveURL(/\/admin\/passwort\/neu$/)
    await expect(page.getByTestId('passwort-neu-balken')).toHaveCount(0)
    await expect(page.getByTestId('passwort-neu-gueltigkeit')).toHaveText(
      'Die PIN ist 15 Minuten ab Anforderung gültig.',
    )
  })

  test('uebersteht ein Neuladen von Schritt 2 mit dem Zeitpunkt der Anforderung', async ({ page }) => {
    await adminServer(page)
    await page.goto('/admin/passwort/vergessen')
    await page.getByTestId('passwort-vergessen-absenden').click()
    await expect(page.getByTestId('passwort-neu-balken')).toBeVisible()
    const text = await page.getByTestId('passwort-neu-gueltigkeit').textContent()

    await page.reload()

    // Der Zustand liegt in `history.state`: gleiche Uhrzeit, Balken noch da.
    await expect(page.getByTestId('passwort-neu-balken')).toBeVisible()
    await expect(page.getByTestId('passwort-neu-gueltigkeit')).toHaveText(text!)
  })

  test('passt auf dem Telefon ohne Scrollen, auch mit Meldung und Link', async ({ page }) => {
    test.skip(!genugHoch(page), 'Unter 740 px Fensterhoehe scrollen die Ansichten (Entscheidung C3).')
    const server = await adminServer(page)
    server.bestaetigungen = ['ungueltig']
    await page.goto('/admin/passwort/vergessen')
    expect(await ueberhang(page)).toBeLessThanOrEqual(0)

    await page.getByTestId('passwort-vergessen-absenden').click()
    await expect(page).toHaveURL(/\/admin\/passwort\/neu$/)
    expect(await ueberhang(page)).toBeLessThanOrEqual(0)

    await page.getByTestId('reset-pin-feld').fill('11111')
    await page.getByTestId('passwort-neu-passwort').fill('beispiel-passwort-02')
    await page.getByTestId('passwort-neu-absenden').click()
    await expect(page.getByTestId('passwort-neu-neu-anfordern')).toBeVisible()

    expect(await ueberhang(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('Passwort ändern', () => {
  test('beendet die Sitzung und zeigt auf der PIN-Eingabe den Hinweis', async ({ page }) => {
    const server = await adminServer(page, { stage: 'PROFILE_AUTHENTICATED', rolle: 'ADMIN' })
    await page.goto('/admin')
    await expect(page.getByTestId('platzhalter-c7')).toBeVisible()

    await page.getByTestId('admin-passwort-aendern-link').click()
    await expect(page).toHaveURL(/\/admin\/passwort\/aendern$/)
    // Von hier fuehrt „Zurueck" zur Administration, nicht zum User-Dashboard.
    await expect(page.getByTestId('layout-zurueck')).toBeVisible()

    await page.getByTestId('passwort-aendern-alt').fill('beispiel-passwort-01')
    await page.getByTestId('passwort-aendern-neu').fill('beispiel-passwort-02')
    await page.getByTestId('passwort-aendern-absenden').click()

    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('pin-hinweis')).toHaveText(
      'Passwort geändert. Bitte melde dich mit dem neuen Passwort an.',
    )
    expect(server.sitzung.angemeldet).toBe(false)
  })

  test('fuehrt mit Zurueck zur Administration', async ({ page }) => {
    await adminServer(page, { stage: 'PROFILE_AUTHENTICATED', rolle: 'ADMIN' })
    await page.goto('/admin/passwort/aendern')

    await page.getByTestId('layout-zurueck').click()

    await expect(page).toHaveURL(/\/admin$/)
  })

  test('passt auf dem Telefon ohne Scrollen', async ({ page }) => {
    test.skip(!genugHoch(page), 'Unter 740 px Fensterhoehe scrollen die Ansichten (Entscheidung C3).')
    await adminServer(page, { stage: 'PROFILE_AUTHENTICATED', rolle: 'ADMIN' })
    await page.goto('/admin/passwort/aendern')
    await page.getByTestId('passwort-aendern-neu').fill('kurz')

    expect(await ueberhang(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('Passwortfeld', () => {
  test('wechselt mit dem Auge den Typ und meldet den Zustand', async ({ page }) => {
    await adminServer(page)
    await page.goto('/admin/anmelden')
    const feld = page.getByTestId('admin-passwort')
    const umschalter = page.getByTestId('admin-passwort-zeigen')
    await feld.fill('beispiel-passwort-01')

    await expect(feld).toHaveAttribute('type', 'password')
    await expect(umschalter).toHaveAttribute('aria-pressed', 'false')
    await expect(umschalter).toHaveAccessibleName('Passwort anzeigen')
    await expect(page.getByTestId('admin-passwort-symbol')).toHaveAttribute('src', /visibility_on_dark\.png$/)

    await umschalter.click()
    await expect(feld).toHaveAttribute('type', 'text')
    await expect(umschalter).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('admin-passwort-symbol')).toHaveAttribute('src', /visibility_off_dark\.png$/)

    await umschalter.click()
    await expect(feld).toHaveAttribute('type', 'password')
    await expect(umschalter).toHaveAttribute('aria-pressed', 'false')
  })

  test('verbirgt das Passwort beim Absenden wieder', async ({ page }) => {
    const server = await adminServer(page)
    server.anmeldung = 'gesperrt'
    await page.goto('/admin/anmelden')
    await page.getByTestId('admin-name').fill('Beispieladmin')
    await page.getByTestId('admin-passwort').fill('beispiel-passwort-01')
    await page.getByTestId('admin-passwort-zeigen').click()
    await expect(page.getByTestId('admin-passwort')).toHaveAttribute('type', 'text')

    await page.getByTestId('admin-absenden').click()

    await expect(page.getByTestId('admin-fehler')).toBeVisible()
    await expect(page.getByTestId('admin-passwort')).toHaveAttribute('type', 'password')
    await expect(page.getByTestId('admin-passwort-zeigen')).toHaveAttribute('aria-pressed', 'false')
  })

  test('haelt das Tap-Ziel des Auges ein', async ({ page }) => {
    await adminServer(page)
    await page.goto('/admin/anmelden')
    const kasten = await page.getByTestId('admin-passwort-zeigen').boundingBox()
    expect(kasten!.height).toBeGreaterThanOrEqual(44)
    expect(kasten!.width).toBeGreaterThanOrEqual(44)
  })

  test('scrollt auf keiner Admin-Ansicht waagerecht', async ({ page }) => {
    await adminServer(page, { stage: 'PROFILE_AUTHENTICATED', rolle: 'ADMIN' })
    for (const pfad of ['/admin', '/admin/passwort/aendern']) {
      await page.goto(pfad)
      await expect(page.getByTestId('app-layout')).toBeVisible()
      const { scrollbreite, sichtbreite } = await page.evaluate(() => ({
        scrollbreite: document.documentElement.scrollWidth,
        sichtbreite: document.documentElement.clientWidth,
      }))
      expect(scrollbreite, pfad).toBeLessThanOrEqual(sichtbreite)
    }
  })
})
