import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Prueft den Rahmen der Anwendung auf allen Geraeteprojekten.
 *
 * Bewusst ohne Service Worker und ohne Manifest: Diese Datei soll auch in den
 * WebKit-Projekten laufen. Was hier scheitert, scheitert auf einem echten
 * Telefon ebenfalls – Umbrueche, Tap-Ziele, horizontales Scrollen.
 *
 * Die Tests laufen ohne erreichbaren Server, also ohne Sitzung. Erreichbar
 * bleiben muessen in diesem Zustand die PIN-Eingabe – der Einstieg in die
 * Anwendung – und die Admin-Anmeldung. Die Zurueck-Schaltflaeche wird an der
 * Admin-Anmeldung geprueft, weil die Login-Schritte sie bewusst nicht zeigen.
 */
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
    await expect(page.getByTestId('platzhalter-c7')).toBeHidden()
  })

  test('laesst die Admin-Anmeldung offen', async ({ page }) => {
    // Ohne diese Ausnahme koennte sich der Admin nie anmelden.
    await page.goto('/admin/anmelden')
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
    await expect(page.getByTestId('platzhalter-c4')).toBeVisible()
  })

  test('zeigt die Zurueck-Navigation jenseits der Startseite', async ({ page }) => {
    await page.goto('/admin/anmelden')
    await expect(page.getByTestId('layout-zurueck')).toBeVisible()
  })

  test('fuehrt beim Direkteinstieg mit Zurueck zur Startseite statt aus der Anwendung', async ({ page }) => {
    // Direkteinstieg: Vor diesem Eintrag liegt im Tab nur `about:blank`. Ein
    // `navigate(-1)` fuehrte dorthin und verliesse die Anwendung.
    await page.goto('/admin/anmelden')
    await page.getByTestId('layout-zurueck').click()
    // Ohne Sitzung leitet die Startseite zur PIN-Eingabe weiter.
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
  })

  test('geht nach einem Schritt innerhalb der Anwendung mit Zurueck dorthin zurueck', async ({ page }) => {
    await page.goto('/pin/pruefen')
    await page.getByTestId('pin-admin-link').click()
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
    await page.getByTestId('layout-zurueck').click()
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
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
    await page.goto('/pin/pruefen')
    await expect(page.getByTestId('pin-feld')).toBeFocused()

    await page.keyboard.press('Tab')

    // „Absenden" ist bei leerem Feld gesperrt und wird uebersprungen.
    const link = page.getByTestId('pin-admin-link')
    await expect(link).toBeFocused()
    await pruefeFokusringBreite(page, link)
  })

  test('legt den Offline-Hinweis ueber die Kopfzeile und laesst ihn wegklicken', async ({ page, context }) => {
    await page.goto('/admin/anmelden')
    const inhalt = page.getByTestId('platzhalter-c4')
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
