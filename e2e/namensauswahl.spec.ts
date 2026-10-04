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

  test('haelt die drei Stufen gleich breit und gleich hoch', async ({ page }) => {
    await pinGeprueft(page)
    await page.goto('/anmelden')
    await waehlen(page, 'gast')

    // Gemessen wird das sichtbare Etikett, nicht der unsichtbare Radioknopf:
    // Der liegt ueber dem ganzen `label` und wird mit der Rasterzeile
    // gestreckt, auch wenn das Etikett darin kuerzer bleibt. Gemessen wird
    // nach jedem Wechsel der Auswahl, weil die gewaehlte Stufe halbfett setzt.
    const stufen = ['gast-stufe-schwach', 'gast-stufe-mittel', 'gast-stufe-stark']
    // Belastungsprobe: ein langer Text ohne Trennstelle, der mehrere Zeilen
    // braucht. Die heutigen Texte passen dank ihrer Trennstellen auch in ein
    // nachgiebiges Raster; erst dieser Text deckt auf, ob Breite und Hoehe
    // wirklich vom Raster kommen. React setzt den Text beim Neurendern nicht
    // zurueck, weil sich sein Wert aus Sicht von React nicht aendert.
    await page
      .locator('[data-testid="gast-stufe-stark"] + span')
      .evaluate((etikett) => (etikett.textContent = 'Torschützenkönigin des Jahres'))
    for (const gewaehlt of stufen) {
      await page.getByTestId(gewaehlt).check()
      const kaesten = await Promise.all(
        stufen.map((id) => page.locator(`[data-testid="${id}"] + span`).boundingBox()),
      )
      const breiten = kaesten.map((k) => Math.round(k!.width))
      const hoehen = kaesten.map((k) => Math.round(k!.height))
      // Bis 04.10.2026 wuchs die Spalte mit dem laengsten Wort (360 px: 97/74/107).
      expect(new Set(breiten).size, `Breiten ${breiten.join('/')}`).toBe(1)
      expect(new Set(hoehen).size, `Hoehen ${hoehen.join('/')}`).toBe(1)
    }
  })

  test('meldet einen Verbindungsverlust genau einmal und ohne zu scrollen', async ({ page }) => {
    await page.route('**/api/v1/auth/session/lesen', (route) =>
      route.fulfill({ json: { stage: 'PIN_VERIFIED' } }),
    )
    let offline = false
    await page.route('**/api/v1/auth/users/lesen', (route) =>
      offline
        ? route.abort()
        : route.fulfill({ json: [{ id: 11, name: 'Beispielspieler 01', belegt: false }] }),
    )
    await page.goto('/anmelden')
    await waehlen(page, 'gast')

    // Ab jetzt scheitert das Polling (alle fuenf Sekunden) ohne Antwort, und
    // auch die Symboldateien sind nicht mehr abrufbar – wie bei einem
    // ausgefallenen Server der Anwendung (Fehlerbild vom 04.10.2026).
    await page.route('**/icons/**', (route) => route.abort())
    offline = true
    const meldung = page.getByTestId('namensauswahl-listenfehler')
    await expect(meldung).toBeVisible({ timeout: 8_000 })
    await expect(meldung).toHaveText('Der Server ist nicht erreichbar. Bitte versuche es später erneut.')
    // Fester Umbruch zwischen den beiden Saetzen: genau zwei Zeilen, die zweite
    // beginnt mit „Bitte“.
    const zeilen = await meldung.locator('span').last().evaluate((text) => {
      const bereich = document.createRange()
      bereich.selectNodeContents(text)
      const oben = new Set([...bereich.getClientRects()].map((r) => Math.round(r.top)))
      return { anzahl: oben.size, umbruch: getComputedStyle(text).whiteSpace }
    })
    expect(zeilen).toEqual({ anzahl: 2, umbruch: 'pre-line' })
    // Das Symbol kommt aus dem Buendel, nicht aus einem Abruf.
    const maske = await meldung
      .getByTestId('icon-error_circle_icon')
      .evaluate((symbol) => getComputedStyle(symbol).getPropertyValue('--icon-quelle'))
    expect(maske).toContain('data:image/svg+xml')

    // Nur eine Meldung: die der Ansicht, nicht zusaetzlich der Offline-Hinweis
    // (Rueckmeldung vom 04.10.2026). Die Liste bleibt stehen.
    await expect(page.getByTestId('offline-hinweis')).toBeHidden()
    await expect(page.getByTestId('namensauswahl-liste')).toBeVisible()
    // Auf dem Telefon kein Scrollen: Die Meldung ersetzt den Hinweis der Liste.
    if (page.viewportSize()!.width < 600) {
      const { scrollhoehe, sichthoehe } = await page.evaluate(() => ({
        scrollhoehe: document.documentElement.scrollHeight,
        sichthoehe: document.documentElement.clientHeight,
      }))
      expect(scrollhoehe).toBeLessThanOrEqual(sichthoehe)
    }
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
