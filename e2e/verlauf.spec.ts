import { expect, test } from '@playwright/test'
import { ergebnisseNachbilden } from './hilfen/ergebnisse.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft den Tab „Verlauf“ (C5, Stufe 4) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung und Termine sind nachgebildet. Die vergangenen Termine liegen relativ
 * zu heute, denn der Verlauf liest nur die letzten Tage (E14).
 */

/** Das Datum vor `n` Tagen (Ortszeit des Browsers, wie der Client rechnet). */
function vorTagen(n: number): string {
  const t = new Date(Date.now() - n * 86_400_000)
  const zwei = (z: number) => String(z).padStart(2, '0')
  return `${String(t.getFullYear())}-${zwei(t.getMonth() + 1)}-${zwei(t.getDate())}`
}

test.describe('Tab Verlauf', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('zeigt abgeschlossene und abgesagte Termine, neueste zuerst, und nur die abgeschlossenen als Link', async ({ page }) => {
    await termineNachbilden(page, [
      terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: vorTagen(21) }),
      terminModell({ terminId: 2, status: 'ABGESAGT', datum: vorTagen(14), zusagen: [] }),
      terminModell({ terminId: 3, status: 'ABGESCHLOSSEN', datum: vorTagen(7) }),
      terminModell({ terminId: 4, datum: '2099-01-13' }),
    ])
    await page.goto('/verlauf')

    await expect(page.getByTestId('tab-verlauf')).toHaveAttribute('aria-current', 'page')
    const zeilen = page.getByTestId('verlauf-liste').getByRole('listitem')
    await expect(zeilen).toHaveCount(3)
    await expect(zeilen.nth(0).getByTestId('verlauf-link-3')).toBeVisible()
    await expect(zeilen.nth(1).getByTestId('verlauf-zeile-2')).toContainText('Abgesagt')
    await expect(zeilen.nth(2).getByTestId('verlauf-link-1')).toBeVisible()
    await expect(page.getByTestId('verlauf-link-2')).toHaveCount(0)
    await expect(page.getByTestId('verlauf-hinweis')).toContainText('Angezeigt werden die Termine der letzten 60 Tage.')
  })

  test('liest den Verlauf mit Stichtag und Hintergrundkopf und fragt nicht nach', async ({ page }) => {
    const abrufe: { ab: string | null; kopf: string | undefined }[] = []
    await termineNachbilden(page, [terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: vorTagen(3) })])
    // Die zuletzt angemeldete Route gewinnt: Sie sieht den Abruf zuerst und reicht ihn weiter.
    await page.route(
      (url) => url.pathname === '/api/v1/termine/lesen',
      (route) => {
        abrufe.push({
          ab: new URL(route.request().url()).searchParams.get('ab'),
          kopf: route.request().headers()['x-fubo-kein-refresh'],
        })
        return route.fallback()
      },
    )
    await page.clock.install()
    await page.goto('/verlauf')
    await expect(page.getByTestId('verlauf-liste')).toBeVisible()

    expect(abrufe).toHaveLength(1)
    expect(abrufe[0].ab).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(abrufe[0].kopf).toBe('true')
    // Kein Polling: Auch nach Minuten kommt kein zweiter Abruf.
    await page.clock.runFor(120_000)
    expect(abrufe).toHaveLength(1)
  })

  test('fuehrt ueber die Zeile zum Ergebnis des Termins, ohne Tab-Leiste', async ({ page }) => {
    const welt = await termineNachbilden(page, [
      terminModell({ terminId: 7, status: 'ABGESCHLOSSEN', datum: vorTagen(3) }),
    ])
    await ergebnisseNachbilden(page, welt)
    await page.goto('/verlauf')
    await page.getByTestId('verlauf-link-7').click()

    await expect(page).toHaveURL(/\/ergebnisse\/7$/)
    await expect(page.getByTestId('tab-leiste')).toHaveCount(0)
    await expect(page.getByTestId('ergebnis-ohne-einteilung')).toBeVisible()
  })

  test('zeigt ohne vergangene Termine den Leerzustand', async ({ page }) => {
    await termineNachbilden(page, [terminModell({ terminId: 4, datum: '2099-01-13' })])
    await page.goto('/verlauf')

    await expect(page.getByTestId('verlauf-leer')).toContainText('Noch keine vergangenen Termine')
    await expect(page.getByTestId('verlauf-liste')).toHaveCount(0)
  })
})

test.describe('Layout bei 360 x 780', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('scrollt nicht waagerecht, haelt die Zeilen 44 px hoch und die Tab-Leiste im Sichtfeld', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    await termineNachbilden(page, [
      terminModell({
        terminId: 1,
        status: 'ABGESCHLOSSEN',
        datum: vorTagen(14),
        ort: 'Eine Halle mit einem sehr langen Namen am Stadtrand',
      }),
      terminModell({ terminId: 2, status: 'ABGESAGT', datum: vorTagen(7), zusagen: [] }),
    ])
    await page.goto('/verlauf')
    await expect(page.getByTestId('verlauf-liste')).toBeVisible()

    const breiten = await page.evaluate(() => ({
      inhalt: document.documentElement.scrollWidth,
      sicht: document.documentElement.clientWidth,
    }))
    expect(breiten.inhalt).toBeLessThanOrEqual(breiten.sicht)
    for (const id of ['verlauf-link-1', 'verlauf-zeile-2']) {
      const zeile = await page.getByTestId(id).boundingBox()
      expect(zeile!.height).toBeGreaterThanOrEqual(43.5)
    }
    const leiste = await page.getByTestId('tab-leiste').boundingBox()
    expect(leiste!.y + leiste!.height).toBeLessThanOrEqual(780 + 0.5)
  })
})
