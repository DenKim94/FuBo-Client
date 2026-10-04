import { expect, test, type Page } from '@playwright/test'

/**
 * Prueft den Ablauf-Dialog der Sitzung im echten Browser (C3).
 *
 * Das ist der Teil, den die Unit-Tests nicht sehen koennen: Dialog als Bottom
 * Sheet am unteren Rand, Fokusfalle, Escape im Modus `festhalten`, Rueckgabe
 * des Fokus. jsdom bildet davon nur `open` nach (src/test/setup.ts).
 *
 * Ohne Server: Die Sitzung wird mit `page.route` nachgebildet, ihre Enden
 * relativ zu jetzt. Die Zustaende liegen im Test und lassen sich zwischen
 * zwei Abrufen aendern.
 */

/** Zustand der nachgebildeten Sitzung. */
type Sitzung = {
  /** Sekunden bis zum Ende des Leerlauf-Fensters. */
  leerlaufSek: number
  /** Sekunden bis zur harten Obergrenze. */
  obergrenzeSek: number
  angemeldet: boolean
  /** Aufrufe von `/auth/session/erneuern` und `/auth/session/beenden`. */
  erneuert: number
  beendet: number
  /**
   * Abrufe von `/auth/session/lesen` **ohne** `X-FuBo-Kein-Refresh`. Der echte
   * Server verschiebt bei jedem davon das Leerlauf-Fenster; die Nachbildung
   * zaehlt sie nur, damit ein Test unbeabsichtigte Verlaengerungen sieht.
   */
  verlaengernd: number
}

/** Bildet die Sitzungs-Endpunkte nach und gibt den veraenderbaren Zustand zurueck. */
async function sitzungNachbilden(page: Page, anfang: Partial<Sitzung> = {}): Promise<Sitzung> {
  const sitzung: Sitzung = {
    leerlaufSek: 90,
    obergrenzeSek: 3600,
    angemeldet: true,
    erneuert: 0,
    beendet: 0,
    verlaengernd: 0,
    ...anfang,
  }
  await page.route('**/api/v1/auth/session/lesen', (route) => {
    if (route.request().headers()['x-fubo-kein-refresh'] !== 'true') sitzung.verlaengernd += 1
    if (!sitzung.angemeldet) {
      return route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', status: 401, code: 'SESSION_UNGUELTIG', detail: 'Die Sitzung ist abgelaufen.' },
      })
    }
    // Eine Uhrablesung fuer beide Enden: Der Server klemmt `gueltigBis` auf
    // `absolutGueltigBis`, die beiden sind dann **exakt** gleich. Zwei
    // getrennte `Date.now()` wichen manchmal um eine Millisekunde ab, und der
    // Dialog hielt die Sitzung fuer verlaengerbar (Flackern nur auf einem Projekt).
    const jetzt = Date.now()
    return route.fulfill({
      json: {
        stage: 'PROFILE_AUTHENTICATED',
        rolle: 'USER',
        anzeigeName: 'Beispielspieler 03',
        gueltigBis: new Date(jetzt + sitzung.leerlaufSek * 1000).toISOString(),
        absolutGueltigBis: new Date(jetzt + sitzung.obergrenzeSek * 1000).toISOString(),
      },
    })
  })
  await page.route('**/api/v1/auth/session/erneuern', (route) => {
    sitzung.erneuert += 1
    // Wie der Server: neues Fenster, aber nie ueber die Obergrenze.
    sitzung.leerlaufSek = Math.min(900, sitzung.obergrenzeSek)
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/auth/session/beenden', (route) => {
    sitzung.beendet += 1
    sitzung.angemeldet = false
    return route.fulfill({ status: 204 })
  })
  return sitzung
}

/**
 * Stoesst einen neuen Abruf an: Rueckkehr in den Tab, wie nach dem Entsperren
 * des Telefons. TanStack Query hoert am `window` auf `visibilitychange`; der
 * Browser feuert das Ereignis am Dokument und es steigt auf. Ein Ereignis ohne
 * `bubbles` erreichte das `window` nie.
 */
async function neuLesen(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange', { bubbles: true })))
}

test.describe('Ablauf-Dialog der Sitzung', () => {
  test('bleibt zu, solange das Ende fern ist', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 600 })
    await page.goto('/')
    await expect(page.getByTestId('platzhalter-c5')).toBeVisible()

    await expect(page.getByTestId('sitzung-ablauf-dialog')).toBeHidden()
  })

  test('erscheint am unteren Rand mit grossen Tap-Zielen und ohne waagerechtes Scrollen', async ({
    page,
    viewport,
  }) => {
    await sitzungNachbilden(page)
    await page.goto('/')

    const dialog = page.getByTestId('sitzung-ablauf-dialog')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Sitzung läuft ab' })).toBeVisible()
    await expect(page.getByTestId('sitzung-ablauf-text')).toHaveText(
      'Deine Sitzung läuft gleich ab. Verlängere sie, um weiterzuarbeiten.',
    )
    // Keine Restzeit als Zahl; der Balken zeigt den Verlauf.
    await expect(page.getByTestId('sitzung-ablauf-restzeit')).toHaveCount(0)
    await expect(page.getByTestId('sitzung-ablauf-balken')).toBeVisible()

    // Primaer 64 px (--tapziel-primaer), sonst mindestens 44 px (DESIGN.md).
    const verlaengern = await page.getByTestId('sitzung-ablauf-verlaengern').boundingBox()
    const abmelden = await page.getByTestId('sitzung-ablauf-abmelden').boundingBox()
    expect(verlaengern!.height).toBeGreaterThanOrEqual(64)
    expect(abmelden!.height).toBeGreaterThanOrEqual(44)

    // Beide Schaltflaechen liegen komplett im sichtbaren Bereich.
    for (const kasten of [verlaengern!, abmelden!]) {
      expect(kasten.y).toBeGreaterThanOrEqual(0)
      expect(kasten.y + kasten.height).toBeLessThanOrEqual(viewport!.height)
      expect(kasten.x).toBeGreaterThanOrEqual(0)
      expect(kasten.x + kasten.width).toBeLessThanOrEqual(viewport!.width)
    }

    const { scrollbreite, sichtbreite } = await page.evaluate(() => ({
      scrollbreite: document.documentElement.scrollWidth,
      sichtbreite: document.documentElement.clientWidth,
    }))
    expect(scrollbreite).toBeLessThanOrEqual(sichtbreite)
  })

  test('liegt auf dem Telefon am unteren Rand, auf dem Tablet mittig', async ({ page, viewport }) => {
    await sitzungNachbilden(page)
    await page.goto('/')
    const dialog = page.getByTestId('sitzung-ablauf-dialog')
    await expect(dialog).toBeVisible()

    const kasten = (await dialog.boundingBox())!
    if (viewport!.width < 640) {
      // Bottom Sheet: randlos unten angedockt (40rem = 640 px Umschaltung).
      expect(Math.round(kasten.y + kasten.height)).toBe(viewport!.height)
      expect(Math.round(kasten.width)).toBe(viewport!.width)
    } else {
      expect(kasten.y + kasten.height).toBeLessThan(viewport!.height)
      expect(kasten.x).toBeGreaterThan(0)
    }
  })

  test('holt den Fokus in den Dialog und haelt ihn dort', async ({ page, browserName }) => {
    await sitzungNachbilden(page)
    await page.goto('/')
    // Eine Schaltflaeche hinter dem Dialog, ausserhalb von React angelegt: Die
    // Ansicht dahinter hat sonst nichts Fokussierbares, und eine Fokusfalle liesse
    // sich nicht von einer fehlenden unterscheiden.
    await page.evaluate(() => {
      const hinten = document.createElement('button')
      hinten.id = 'e2e-hinter-dialog'
      hinten.textContent = 'Hinter dem Dialog'
      document.body.prepend(hinten)
    })
    await expect(page.getByTestId('sitzung-ablauf-dialog')).toBeVisible()

    // Beim Oeffnen landet der Fokus auf der ersten Schaltflaeche: „Sitzung
    // verlaengern", einer Aktion ohne Verlust.
    await expect(page.getByTestId('sitzung-ablauf-verlaengern')).toBeFocused()

    // WebKit tabbt ohne Systemeinstellung nicht auf Schaltflaechen
    // (AGENT_CLIENT.md); dort bleibt der Rest Handpruefung.
    test.skip(browserName === 'webkit', 'Tab auf Schaltflaechen ist in WebKit ohne Systemeinstellung nicht moeglich')

    // Tab kreist durch beide Optionen und ueber den Browserrahmen (dann steht
    // der Fokus kurz auf dem Dokument). Er darf nie auf die Schaltflaeche
    // hinter dem Dialog fallen: Der Hintergrund ist inert.
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('sitzung-ablauf-abmelden')).toBeFocused()
    for (let schritt = 0; schritt < 8; schritt += 1) {
      await page.keyboard.press('Tab')
      const aktiv = await page.evaluate(() => document.activeElement?.id ?? '')
      expect(aktiv, `Fokus nach ${schritt + 2} Tab`).not.toBe('e2e-hinter-dialog')
    }
  })

  test('schliesst bei Escape nicht, solange sich die Sitzung verlaengern laesst', async ({ page }) => {
    await sitzungNachbilden(page)
    await page.goto('/')
    const dialog = page.getByTestId('sitzung-ablauf-dialog')
    await expect(dialog).toBeVisible()

    // Mehrfach, ohne Klick dazwischen: Seit Chrome 122 (Close Watcher) ist erst
    // das zweite Escape ohne Nutzeraktivierung nicht mehr abweisbar. Hier
    // greift das Wiederoeffnen in `Dialog` (`festhalten`).
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
    }
    await expect(page.getByTestId('sitzung-ablauf-verlaengern')).toBeVisible()
  })

  test('die Rueckkehr in den Tab verlaengert die Sitzung nicht', async ({ page }) => {
    // Handpruefung vom 04.10.2026: Jede Rueckkehr las `useSitzung` ohne
    // `X-FuBo-Kein-Refresh` neu, der Server schob das Fenster nach hinten, und
    // der Dialog erschien nie. Chrome unter macOS meldet schon ein verdecktes
    // Fenster als `hidden`.
    const sitzung = await sitzungNachbilden(page, { leerlaufSek: 600 })
    // Die Uhr laeuft normal weiter, laesst sich aber vorstellen.
    await page.clock.install()
    await page.goto('/')
    await expect(page.getByTestId('platzhalter-c5')).toBeVisible()
    // Der Startaufruf zaehlt als Aktivitaet (Neuladen), das ist gewollt.
    expect(sitzung.verlaengernd).toBe(1)

    // Ueber die `staleTime` von `useSitzung` (10 s) hinaus, sonst laese sie
    // ohnehin nicht neu und der Test bewiese nichts.
    await page.clock.fastForward(15_000)
    const fristAbruf = page.waitForRequest(
      (anfrage) =>
        anfrage.url().endsWith('/auth/session/lesen') &&
        anfrage.headers()['x-fubo-kein-refresh'] === 'true',
    )
    await neuLesen(page)
    // Der Frist-Abruf liest den aktuellen Stand, ohne das Fenster zu verschieben.
    await fristAbruf

    expect(sitzung.verlaengernd).toBe(1)
  })

  test('verlaengert, schliesst und gibt den Fokus an das Feld zurueck', async ({ page }) => {
    const sitzung = await sitzungNachbilden(page, { leerlaufSek: 600 })
    await page.goto('/')
    await expect(page.getByTestId('platzhalter-c5')).toBeVisible()

    // Ein Feld mit Eingabe, die der Dialog nicht anruehren darf. Ausserhalb von
    // React angelegt: Geprueft wird, was der Browser mit Fokus und Wert tut.
    await page.evaluate(() => {
      const feld = document.createElement('input')
      feld.id = 'e2e-feld'
      document.body.prepend(feld)
      feld.focus()
    })
    await page.locator('#e2e-feld').fill('Tor in der 59. Minute')

    // Jetzt naht das Ende, und die Rueckkehr in den Tab liest die Sitzung neu.
    sitzung.leerlaufSek = 90
    await neuLesen(page)
    const dialog = page.getByTestId('sitzung-ablauf-dialog')
    await expect(dialog).toBeVisible()

    await page.getByTestId('sitzung-ablauf-verlaengern').click()

    await expect(dialog).toBeHidden()
    expect(sitzung.erneuert).toBe(1)
    await expect(page.locator('#e2e-feld')).toBeFocused()
    await expect(page.locator('#e2e-feld')).toHaveValue('Tor in der 59. Minute')
  })

  test('meldet ab und fuehrt zur PIN-Eingabe', async ({ page }) => {
    const sitzung = await sitzungNachbilden(page)
    await page.goto('/')
    await expect(page.getByTestId('sitzung-ablauf-dialog')).toBeVisible()

    await page.getByTestId('sitzung-ablauf-abmelden').click()

    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('pin-eingabe')).toBeVisible()
    expect(sitzung.beendet).toBe(1)
  })

  test('fuehrt zur PIN-Eingabe, wenn der Server die Sitzung fuer beendet erklaert', async ({ page }) => {
    // Eine untaetige Person: Niemand ruft etwas auf, nur der Abruf der
    // Restlaufzeit bemerkt den Ablauf.
    const sitzung = await sitzungNachbilden(page)
    await page.goto('/')
    await expect(page.getByTestId('sitzung-ablauf-dialog')).toBeVisible()

    sitzung.angemeldet = false

    // Hoechstens ein dichter Abruf (5 s) spaeter.
    await expect(page).toHaveURL(/\/pin\/pruefen$/, { timeout: 15_000 })
  })

  test('nennt an der harten Obergrenze den Fall ruhig und schliesst bei „Weiterarbeiten"', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 90, obergrenzeSek: 90 })
    await page.goto('/')
    const dialog = page.getByTestId('sitzung-ablauf-dialog')
    await expect(dialog).toBeVisible()

    await expect(page.getByRole('dialog', { name: 'Sitzung endet bald' })).toBeVisible()
    await expect(page.getByTestId('sitzung-ablauf-text')).toContainText('lässt sich nicht mehr verlängern')
    await expect(page.getByTestId('sitzung-ablauf-verlaengern')).toHaveCount(0)
    await expect(page.getByTestId('sitzung-ablauf-fehler')).toHaveCount(0)

    await page.getByTestId('sitzung-ablauf-weiterarbeiten').click()
    await expect(dialog).toBeHidden()

    // Kommt nicht wieder, auch nicht nach mehreren Abrufen.
    await page.waitForTimeout(2500)
    await expect(dialog).toBeHidden()
  })

  test('schliesst an der harten Obergrenze auch bei Escape', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 90, obergrenzeSek: 90 })
    await page.goto('/')
    const dialog = page.getByTestId('sitzung-ablauf-dialog')
    await expect(dialog).toBeVisible()

    // Hier gibt es nichts zu entscheiden; Escape heisst „Weiterarbeiten".
    await page.keyboard.press('Escape')

    await expect(dialog).toBeHidden()
  })
})

test.describe('Abmelden in der Kopfzeile', () => {
  test('steht auf der Startseite rechts, mit ausreichend grossem Tap-Ziel', async ({
    page,
    viewport,
  }) => {
    // Ende fern: Der Ablauf-Dialog soll nicht dazwischenfunken.
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    await page.goto('/')
    await expect(page.getByTestId('platzhalter-c5')).toBeVisible()

    const abmelden = page.getByTestId('layout-abmelden')
    await expect(abmelden).toBeVisible()
    // Auf der Startseite gibt es kein „Zurueck".
    await expect(page.getByTestId('layout-zurueck')).toBeHidden()

    const kasten = await abmelden.boundingBox()
    expect(kasten!.height).toBeGreaterThanOrEqual(44)
    // Am rechten Rand der Kopfzeile, vollstaendig sichtbar.
    expect(kasten!.x + kasten!.width).toBeLessThanOrEqual(viewport!.width)
    expect(kasten!.x).toBeGreaterThan(viewport!.width / 2)

    const { scrollbreite, sichtbreite } = await page.evaluate(() => ({
      scrollbreite: document.documentElement.scrollWidth,
      sichtbreite: document.documentElement.clientWidth,
    }))
    expect(scrollbreite).toBeLessThanOrEqual(sichtbreite)
  })

  test('liegt auf einer Unterseite gegenueber von Zurueck', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    await page.goto('/einstellungen')

    const zurueck = await page.getByTestId('layout-zurueck').boundingBox()
    const abmelden = await page.getByTestId('layout-abmelden').boundingBox()
    // Zwei Schaltflaechen, die sich nicht beruehren: Ein Tippen trifft nicht die falsche.
    expect(zurueck!.x + zurueck!.width).toBeLessThan(abmelden!.x)
  })

  test('meldet ab und fuehrt zur PIN-Eingabe', async ({ page }) => {
    const sitzung = await sitzungNachbilden(page, { leerlaufSek: 900 })
    await page.goto('/')

    await page.getByTestId('layout-abmelden').click()

    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('pin-eingabe')).toBeVisible()
    expect(sitzung.beendet).toBe(1)
    // Auf der PIN-Eingabe gibt es nichts mehr abzumelden.
    await expect(page.getByTestId('layout-abmelden')).toBeHidden()
  })

  test('bleibt angemeldet und nennt den Grund, wenn der Server das Abmelden ablehnt', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    // Spaeter registrierte Routen gelten zuerst.
    await page.route('**/api/v1/auth/session/beenden', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', status: 500, code: 'INTERNER_FEHLER', detail: 'Abmelden gerade nicht möglich.' },
      }),
    )
    await page.goto('/')

    await page.getByTestId('layout-abmelden').click()

    await expect(page.getByTestId('layout-abmelden-fehler')).toBeVisible()
    await expect(page).not.toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('layout-abmelden')).toBeEnabled()
  })
})
