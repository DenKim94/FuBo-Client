import { expect, test } from '@playwright/test'

/**
 * Prueft den Rahmen der Anwendung auf allen Geraeteprojekten.
 *
 * Bewusst ohne Service Worker und ohne Manifest: Diese Datei soll auch in den
 * WebKit-Projekten laufen. Was hier scheitert, scheitert auf einem echten
 * Telefon ebenfalls – Umbrueche, Tap-Ziele, horizontales Scrollen.
 *
 * Die Tests laufen ohne erreichbaren Server, also ohne Sitzung. Geprueft wird
 * deshalb `/anmelden`: die einzige Ansicht, die in diesem Zustand erreichbar
 * bleiben **muss**.
 */
test.describe('Rahmen und Navigation', () => {
  test('leitet ohne Sitzung auf die Anmeldung um', async ({ page }) => {
    await page.goto('/')
    // Der Routen-Schutz greift: Die Startseite verlangt eine abgeschlossene
    // Anmeldung. Ohne Sitzung landet der Aufruf auf /anmelden.
    await expect(page).toHaveURL(/\/anmelden$/)
    await expect(page.getByTestId('app-layout')).toBeVisible()
  })

  test('haelt den Adminbereich ohne Sitzung geschlossen', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/anmelden$/)
    await expect(page.getByTestId('platzhalter-c7')).toBeHidden()
  })

  test('laesst die Admin-Anmeldung offen', async ({ page }) => {
    // Ohne diese Ausnahme koennte sich der Admin nie anmelden.
    await page.goto('/admin/anmelden')
    await expect(page).toHaveURL(/\/admin\/anmelden$/)
    await expect(page.getByTestId('platzhalter-c4')).toBeVisible()
  })

  test('zeigt die Zurueck-Navigation jenseits der Startseite', async ({ page }) => {
    await page.goto('/anmelden')
    await expect(page.getByTestId('layout-zurueck')).toBeVisible()
  })

  test('haelt das Mindestmass fuer Tap-Ziele ein', async ({ page }) => {
    await page.goto('/anmelden')
    const kasten = await page.getByTestId('layout-zurueck').boundingBox()
    expect(kasten).not.toBeNull()
    // 44x44 px aus DESIGN.md (WCAG 2.1 AA). Am schmalsten Geraet zuerst relevant.
    expect(kasten!.width).toBeGreaterThanOrEqual(44)
    expect(kasten!.height).toBeGreaterThanOrEqual(44)
  })

  test('scrollt nicht waagerecht', async ({ page }) => {
    await page.goto('/anmelden')
    const { scrollbreite, sichtbreite } = await page.evaluate(() => ({
      scrollbreite: document.documentElement.scrollWidth,
      sichtbreite: document.documentElement.clientWidth,
    }))
    // Ein waagerechter Ueberlauf ist auf dem Telefon der haeufigste Layoutfehler
    // und faellt auf breiten Schirmen nie auf.
    expect(scrollbreite).toBeLessThanOrEqual(sichtbreite)
  })

  test('verbraucht die Safe-Area-Tokens im Rahmen', async ({ page }) => {
    await page.goto('/anmelden')
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
})
