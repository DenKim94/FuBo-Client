import { expect, test, type Page } from '@playwright/test'

/**
 * Prueft die Namensauswahl (zweite Login-Stufe) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung und Namensliste werden im Browser nachgebildet
 * (`page.route`). Geprueft wird, was nur im echten Browser sichtbar wird –
 * Weiterleitung nach Stufe, native Auswahlliste, Tap-Ziele, Umbruch bei 360 px.
 */

/** Öffnet die Auswahlliste und wählt einen Eintrag über seinen Wert. */
async function waehlen(page: Page, wert: string) {
  await page.getByTestId('namensauswahl-liste').click()
  await page.getByTestId(`namensauswahl-liste-option-${wert}`).click()
}

/** Bildet eine Sitzung in der Stufe PIN_VERIFIED und eine Namensliste nach. */
async function pinGeprueft(page: Page) {
  await page.route('**/api/v1/auth/session/lesen', (route) =>
    route.fulfill({ json: { stage: 'PIN_VERIFIED' } }),
  )
  await page.route('**/api/v1/auth/users/lesen', (route) =>
    route.fulfill({
      json: [
        { id: 11, name: 'Beispielspieler 01', belegt: false },
        { id: 12, name: 'Beispielspieler 02', belegt: true },
      ],
    }),
  )
}

test.describe('Namensauswahl', () => {
  test('fuehrt nach geprueften PIN von der PIN-Eingabe zur Namensauswahl', async ({ page }) => {
    await pinGeprueft(page)
    await page.goto('/pin/pruefen')
    await expect(page).toHaveURL(/\/anmelden$/)
    await expect(page.getByTestId('namensauswahl-liste')).toBeVisible()
    await expect(page.getByTestId('layout-zurueck')).toBeHidden()
  })

  test('graut belegte Namen aus und benennt die Aktion', async ({ page }) => {
    await pinGeprueft(page)
    await page.goto('/anmelden')
    await page.getByTestId('namensauswahl-liste').click()
    await expect(page.getByTestId('namensauswahl-liste-option-12')).toHaveAttribute('aria-disabled', 'true')
    // Ein Tipp auf den belegten Namen aendert nichts, die Liste bleibt offen.
    // `force`: Playwright wartet sonst, bis ein aria-disabled-Element bedienbar
    // wird – genau das soll es nie werden.
    await page.getByTestId('namensauswahl-liste-option-12').click({ force: true })
    await expect(page.getByRole('listbox')).toBeVisible()

    await page.getByTestId('namensauswahl-liste-option-11').click()
    await expect(page.getByTestId('namensauswahl-absenden')).toHaveText('Weiter als Beispielspieler 01')
  })

  test('zeigt den Gastbereich mit ausreichend grossen Tap-Zielen', async ({ page }) => {
    await pinGeprueft(page)
    await page.goto('/anmelden')
    await waehlen(page, 'gast')

    await expect(page.getByTestId('namensauswahl-gast')).toBeVisible()
    for (const testId of ['gast-stufe-schwach', 'gast-stufe-mittel', 'gast-stufe-stark', 'gast-erklaerung']) {
      const kasten = await page.getByTestId(testId).boundingBox()
      expect(kasten, testId).not.toBeNull()
      expect(kasten!.width, testId).toBeGreaterThanOrEqual(44)
      expect(kasten!.height, testId).toBeGreaterThanOrEqual(44)
    }

    await page.getByTestId('gast-name').fill('Testgast')
    await expect(page.getByTestId('namensauswahl-absenden')).toHaveText('Weiter als Testgast (Gast)')

    const { scrollbreite, sichtbreite } = await page.evaluate(() => ({
      scrollbreite: document.documentElement.scrollWidth,
      sichtbreite: document.documentElement.clientWidth,
    }))
    expect(scrollbreite).toBeLessThanOrEqual(sichtbreite)
  })

  test('haelt die Eintraege der aufgeklappten Liste gross genug', async ({ page }) => {
    await pinGeprueft(page)
    await page.goto('/anmelden')
    await page.getByTestId('namensauswahl-liste').click()
    for (const wert of ['gast', '11', '12']) {
      const kasten = await page.getByTestId(`namensauswahl-liste-option-${wert}`).boundingBox()
      expect(kasten!.height, wert).toBeGreaterThanOrEqual(44)
    }
  })

  test('ist per Tastatur bedienbar', async ({ page }) => {
    await pinGeprueft(page)
    await page.goto('/anmelden')
    await page.getByTestId('namensauswahl-liste').focus()
    await page.keyboard.press('ArrowDown') // oeffnet, Gast hervorgehoben
    await page.keyboard.press('ArrowDown') // Beispielspieler 01
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('namensauswahl-absenden')).toHaveText('Weiter als Beispielspieler 01')
  })
})
