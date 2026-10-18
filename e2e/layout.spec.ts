import { expect, test, type Locator, type Page } from '@playwright/test'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft den Rahmen der Anwendung auf allen Geraeteprojekten.
 *
 * Bewusst ohne Service Worker und ohne Manifest: Diese Datei soll auch in den
 * WebKit-Projekten laufen. Was hier scheitert, scheitert auf einem echten
 * Telefon ebenfalls – Umbrueche, Tap-Ziele, horizontales Scrollen.
 *
 * Die Tests laufen ohne erreichbaren Server. Ohne Sitzung bleibt nur die
 * PIN-Eingabe erreichbar – der Einstieg in die Anwendung. Die Admin-Anmeldung
 * liegt seit C4 hinter der PIN (Stufe `PIN_VERIFIED`, Vertrag); die Tests, die
 * sie brauchen, bilden diese Sitzung nach (`hilfen/sitzung.ts`). Die
 * Zurueck-Schaltflaeche wird an der Admin-Anmeldung geprueft, weil die
 * Login-Schritte sie bewusst nicht zeigen.
 */

/** Bildet eine Sitzung nach der PIN-Pruefung nach (Leerlauf lang, der Ablauf-Dialog bleibt zu). */
async function nachPinPruefung(page: Page) {
  await sitzungNachbilden(page, { stage: 'PIN_VERIFIED', leerlaufSek: 900 })
}

/** Bildet die Namensliste nach, damit die Namensauswahl ohne Server steht. */
async function namensliste(page: Page) {
  await page.route('**/api/v1/auth/users/lesen', (route) =>
    route.fulfill({ json: [{ id: 11, name: 'Beispielspieler 01', belegt: false }] }),
  )
}

/**
 * Prueft die Breite des Fokusrings (Regel aus `_reset.scss`: 3 px).
 *
 * **Toleranz nach unten statt exakt 3 px:** WebKit rundet die Breite im
 * berechneten Stil auf ganze Geraetepixel ab. Bei der Pixeldichte 2,5 des
 * iPad-Profils (`ios-tablet-quer`) sind aus 3 px 7 Geraetepixel geworden, also
 * 2,8 px (CI-Fehler vom 04.10.2026: erwartet 3px, erhalten 2.8px). Chromium
 * meldet bei derselben Dichte 3 px; bei Dichte 2 und 3 liefern beide Engines
 * genau 3 px. Erwartet wird deshalb ein Wert zwischen der abgerundeten Breite
 * und 3 px. Ein fehlender oder zu duenner Ring (0, 1 oder 2 px) faellt weiter durch.
 */
async function pruefeFokusringBreite(page: Page, element: Locator) {
  await expect(element).toHaveCSS('outline-style', 'solid')
  const dichte = await page.evaluate(() => window.devicePixelRatio)
  const untergrenze = Math.floor(3 * dichte) / dichte
  const breite = () => element.evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth))
  await expect.poll(breite).toBeGreaterThanOrEqual(untergrenze - 0.001)
  await expect.poll(breite).toBeLessThanOrEqual(3)
}

test.describe('Rahmen und Navigation', () => {
  test('beginnt ohne Sitzung mit der PIN-Eingabe', async ({ page }) => {
    await page.goto('/')
    // Der Routen-Schutz greift: Die Startseite verlangt eine abgeschlossene
    // Anmeldung. Ohne Sitzung landet der Aufruf auf der PIN-Eingabe.
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('pin-eingabe')).toBeVisible()
  })

  test('fuehrt ohne Sitzung von der Namensauswahl zur PIN-Eingabe', async ({ page }) => {
    await page.goto('/anmelden')
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
  })

  test('zeigt auf der PIN-Eingabe keine Zurueck-Schaltflaeche', async ({ page }) => {
    await page.goto('/pin/pruefen')
    await expect(page.getByTestId('pin-eingabe')).toBeVisible()
    await expect(page.getByTestId('layout-zurueck')).toBeHidden()
  })

  test('haelt den Adminbereich ohne Sitzung geschlossen', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('admin-dashboard')).toBeHidden()
  })

  test('haelt die Admin-Anmeldung ohne Sitzung geschlossen und oeffnet sie nach der PIN', async ({ page }) => {
    // Seit C4 (Vertrag): Die Admin-Anmeldung verlangt serverseitig PIN_VERIFIED.
    // Ohne Sitzung fuehrt der Aufruf zur PIN-Eingabe, nicht zu einer Ansicht,
    // deren Aktion der Server ohnehin ablehnte.
    await page.goto('/admin/anmelden')
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('admin-anmeldung')).toBeHidden()

    await nachPinPruefung(page)
    await page.goto('/admin/anmelden')
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
    await expect(page.getByTestId('admin-anmeldung')).toBeVisible()
  })

  test('zeigt die Zurueck-Navigation jenseits der Startseite', async ({ page }) => {
    await nachPinPruefung(page)
    await page.goto('/admin/anmelden')
    await expect(page.getByTestId('layout-zurueck')).toBeVisible()
  })

  test('fuehrt beim Direkteinstieg mit Zurueck zur Startseite statt aus der Anwendung', async ({ page }) => {
    // Direkteinstieg: Vor diesem Eintrag liegt im Tab nur `about:blank`. Ein
    // `navigate(-1)` fuehrte dorthin und verliesse die Anwendung. Die Route
    // braucht dafuer **keine** Zielangabe (`handle.zurueck`), sonst griffe diese
    // statt der Direkteinstiegs-Regel: `/teams/1` hat keine.
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    await termineNachbilden(page, [terminModell({ terminId: 1 })])
    await page.goto('/teams/1')
    await expect(page.getByTestId('teams-seite')).toBeVisible()
    await page.getByTestId('layout-zurueck').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('tab-leiste')).toBeVisible()
  })

  test('fuehrt von der Admin-Anmeldung mit Zurueck zur Namensauswahl', async ({ page }) => {
    // Der Weg ist ein Tipp auf den Link in der Namensauswahl (C4, E5). „Zurueck"
    // folgt der Zielangabe der Route, nicht dem Verlauf.
    await nachPinPruefung(page)
    await namensliste(page)
    await page.goto('/anmelden')
    await page.getByTestId('namensauswahl-admin-link').click()
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
    await page.getByTestId('layout-zurueck').click()
    await expect(page).toHaveURL(/\/anmelden$/)
    await expect(page.getByTestId('namensauswahl-liste')).toBeVisible()
  })

  test('fuehrt bei Direkteinstieg in die Admin-Anmeldung mit Zurueck ebenfalls zur Namensauswahl', async ({
    page,
  }) => {
    await nachPinPruefung(page)
    await namensliste(page)
    await page.goto('/admin/anmelden')
    await page.getByTestId('layout-zurueck').click()
    await expect(page).toHaveURL(/\/anmelden$/)
  })

  test('zeigt fuer eine unbekannte Adresse die Seite „nicht gefunden"', async ({ page }) => {
    await page.goto('/gibt-es-nicht')
    // Kein Guard: Ein Tippfehler leitet nicht zur Anmeldung um.
    await expect(page).toHaveURL(/\/gibt-es-nicht$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeVisible()
    await page.getByTestId('nicht-gefunden-start').click()
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
  })

  test('zeigt den Fokusring am fokussierten Eingabefeld', async ({ page }) => {
    await page.goto('/pin/pruefen')
    const feld = page.getByTestId('pin-feld')
    await expect(feld).toBeFocused()
    // Regel aus `_reset.scss`: 3 px in --farbe-fokus. Ein Textfeld erfuellt
    // `:focus-visible` auch nach programmatischem Fokus.
    await pruefeFokusringBreite(page, feld)
  })

  test('zeigt den Fokusring bei Tastaturbedienung', async ({ page, browserName }) => {
    // Safari und WebKit erreichen Links und Schaltflaechen per Tab nur mit der
    // Systemeinstellung „Mit Tab-Taste alle Objekte hervorheben". Der Ring
    // selbst ist oben am Feld in allen Engines geprueft; das Weiterspringen per
    // Tab bleibt fuer WebKit eine Handpruefung (C2-Abnahme, Punkt 9).
    test.skip(browserName === 'webkit', 'WebKit springt per Tab ohne Systemeinstellung nicht auf Links.')
    // Auf der PIN-Seite gibt es nach Tab kein Ziel mehr („Absenden" ist bei
    // leerem Feld gesperrt, der Admin-Link zog in die Namensauswahl um, C4 E5).
    // Dort erreicht Tab nach der Liste den Link; „Weiter" ist ohne Wahl gesperrt.
    await nachPinPruefung(page)
    await namensliste(page)
    await page.goto('/anmelden')
    const link = page.getByTestId('namensauswahl-admin-link')
    await expect(link).toBeVisible()

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      if (await link.evaluate((e) => e === document.activeElement)) break
    }

    await expect(link).toBeFocused()
    await pruefeFokusringBreite(page, link)
  })

  test('legt den Offline-Hinweis ueber die Kopfzeile und laesst ihn wegklicken', async ({ page, context }) => {
    await nachPinPruefung(page)
    await page.goto('/admin/anmelden')
    const inhalt = page.getByTestId('admin-anmeldung')
    const vorher = (await inhalt.boundingBox())!.y

    await context.setOffline(true)
    const hinweis = page.getByTestId('offline-hinweis')
    await expect(hinweis).toBeVisible()
    // Der Streifen beansprucht keinen Platz: Der Inhalt bleibt, wo er war.
    expect((await inhalt.boundingBox())!.y).toBe(vorher)

    await page.getByTestId('offline-hinweis-schliessen').click()
    await expect(hinweis).toBeHidden()
    await context.setOffline(false)
  })

  test('haelt das Mindestmass fuer Tap-Ziele ein', async ({ page }) => {
    await nachPinPruefung(page)
    await page.goto('/admin/anmelden')
    const kasten = await page.getByTestId('layout-zurueck').boundingBox()
    expect(kasten).not.toBeNull()
    // 44x44 px aus DESIGN.md (WCAG 2.1 AA). Am schmalsten Geraet zuerst relevant.
    expect(kasten!.width).toBeGreaterThanOrEqual(44)
    expect(kasten!.height).toBeGreaterThanOrEqual(44)
  })

  test('scrollt nicht waagerecht', async ({ page }) => {
    await page.goto('/pin/pruefen')
    const { scrollbreite, sichtbreite } = await page.evaluate(() => ({
      scrollbreite: document.documentElement.scrollWidth,
      sichtbreite: document.documentElement.clientWidth,
    }))
    // Ein waagerechter Ueberlauf ist auf dem Telefon der haeufigste Layoutfehler
    // und faellt auf breiten Schirmen nie auf.
    expect(scrollbreite).toBeLessThanOrEqual(sichtbreite)
  })

  test('verbraucht die Safe-Area-Tokens im Rahmen', async ({ page }) => {
    await page.goto('/pin/pruefen')
    // `env(safe-area-inset-*)` liefert unter Geraeteemulation immer 0px – auch
    // mit einem iPhone-Deskriptor (nachgemessen am 26.09.2026). Der konkrete
    // Wert kommt vom Betriebssystem und ist nicht Sache der Anwendung. Pruefbar
    // und regressionsanfaellig ist nur, ob das Layout die Tokens ueberhaupt
    // verbraucht; deshalb werden sie hier gesetzt.
    await page.addStyleTag({
      content: ':root { --sicher-oben: 59px; --sicher-unten: 34px; }',
    })
    const rahmen = page.getByTestId('app-layout')
    await expect(rahmen).toHaveCSS('padding-top', '59px')
    await expect(rahmen).toHaveCSS('padding-bottom', '34px')
  })

  test('haelt die Primaeraktion der PIN-Eingabe in Daumenreichweite', async ({ page }) => {
    await page.goto('/pin/pruefen')
    const knopf = await page.getByTestId('pin-absenden').boundingBox()
    const hoehe = page.viewportSize()!.height
    expect(knopf).not.toBeNull()
    // Unteres Drittel des Bildschirms (A2) und 64 px hoch laut Prototyp.
    expect(knopf!.y).toBeGreaterThan(hoehe * 0.6)
    expect(knopf!.height).toBeGreaterThanOrEqual(64)
  })

  test('verbraucht --sicher-unten in der Aktionsleiste', async ({ page }) => {
    await page.goto('/pin/pruefen')
    await page.addStyleTag({ content: ':root { --sicher-unten: 34px; }' })
    // abstand-s (8 px) plus Safe Area – die Primaeraktion liegt ueber dem Home-Indicator.
    await expect(page.getByTestId('aktionsleiste')).toHaveCSS('padding-bottom', '42px')
  })

  test('stellt die PIN-Kaestchen nebeneinander', async ({ page }) => {
    await page.goto('/pin/pruefen')
    const kaestchen = page.getByTestId('pin-kasten')
    await expect(kaestchen).toHaveCount(4)
    const kaesten = await kaestchen.evaluateAll((elemente) =>
      elemente.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y })),
    )
    // Safari (WebKit) stellte die Kaestchen bei `fit-content` an einer
    // umbrechenden Flex-Zeile untereinander (03.10.2026). Alle vier muessen auf
    // einer Hoehe liegen, von links nach rechts.
    expect(new Set(kaesten.map((k) => Math.round(k.y))).size).toBe(1)
    for (let i = 1; i < kaesten.length; i++) expect(kaesten[i].x).toBeGreaterThan(kaesten[i - 1].x)
  })
})
