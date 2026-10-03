import { expect, test } from '@playwright/test'

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
})
