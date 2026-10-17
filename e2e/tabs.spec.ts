import { expect, test, type Page } from '@playwright/test'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft die Tab-Leiste des Dashboards (C5, 9) auf allen Geraeteprojekten.
 *
 * Die Leiste besteht aus vier Links, nicht aus ARIA-Tabs: Jede Ansicht hat eine
 * Adresse, die Tastatur nutzt vier Tabstopps statt Pfeiltasten.
 */

const TABS = [
  { id: 'tab-termine', pfad: '/' },
  { id: 'tab-teams', pfad: '/teams' },
  { id: 'tab-ergebnisse', pfad: '/ergebnisse' },
  { id: 'tab-verlauf', pfad: '/verlauf' },
] as const

async function vorbereiten(page: Page) {
  await sitzungNachbilden(page, { leerlaufSek: 900 })
  await termineNachbilden(page, [terminModell({ terminId: 102 })])
}

test.describe('Tab-Leiste', () => {
  test('wechselt ueber alle vier Bereiche und markiert den aktiven', async ({ page }) => {
    await vorbereiten(page)
    await page.goto('/')

    for (const tab of TABS) {
      await page.getByTestId(tab.id).click()
      await expect(page).toHaveURL(new RegExp(`${tab.pfad === '/' ? '/$' : `${tab.pfad}$`}`))
      for (const andere of TABS) {
        const erwartet = andere.id === tab.id
        if (erwartet) await expect(page.getByTestId(andere.id)).toHaveAttribute('aria-current', 'page')
        else await expect(page.getByTestId(andere.id)).not.toHaveAttribute('aria-current', 'page')
      }
    }
  })

  test('hat vier Links und keine Tab-Rollen', async ({ page }) => {
    await vorbereiten(page)
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: 'Bereiche' }).getByRole('link')).toHaveCount(4)
    await expect(page.getByRole('tab')).toHaveCount(0)
  })

  test('laesst sich mit der Tastatur bedienen', async ({ page }) => {
    await vorbereiten(page)
    await page.goto('/')

    await page.getByTestId('tab-termine').focus()
    // Vier Tabstopps, keine Pfeiltasten: Tab fuehrt zum naechsten Link.
    await page.keyboard.press('Tab')
    await expect(page.getByTestId('tab-teams')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/teams$/)
    await expect(page.getByTestId('tab-teams')).toHaveAttribute('aria-current', 'page')
  })

  test('traegt die Leiste nur auf den vier Bereichen, nicht auf dem Termin', async ({ page }) => {
    await vorbereiten(page)
    await page.goto('/termine/102')
    await expect(page.getByTestId('termin-detail')).toBeVisible()
    await expect(page.getByTestId('tab-leiste')).toHaveCount(0)
  })

  test('leitet den Admin von jedem Bereich nach /admin um', async ({ page }) => {
    await sitzungNachbilden(page, { rolle: 'ADMIN', leerlaufSek: 900 })
    for (const tab of TABS) {
      await page.goto(tab.pfad)
      await expect(page).toHaveURL(/\/admin$/)
    }
  })
})

test.describe('Tab-Leiste bei 360 x 780', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('bricht keine Beschriftung um, scrollt nicht waagerecht und trifft die Tap-Ziele', async ({ page }) => {
    await vorbereiten(page)
    await page.goto('/')
    await expect(page.getByTestId('tab-leiste')).toBeVisible()

    const breiten = await page.evaluate(() => ({
      inhalt: document.documentElement.scrollWidth,
      sicht: document.documentElement.clientWidth,
    }))
    expect(breiten.inhalt).toBeLessThanOrEqual(breiten.sicht)

    for (const tab of TABS) {
      const eintrag = page.getByTestId(tab.id)
      const box = await eintrag.boundingBox()
      expect(box!.height, tab.id).toBeGreaterThanOrEqual(43.5)
      // Eine Zeile: Ein Umbruch ergaebe zwei Rechtecke fuer den Text.
      const zeilen = await eintrag.evaluate((e) => {
        const bereich = document.createRange()
        bereich.selectNodeContents(e)
        return new Set(Array.from(bereich.getClientRects()).map((r) => Math.round(r.top))).size
      })
      expect(zeilen, tab.id).toBe(1)
    }

    // Von Rand zu Rand: Die Leiste reicht ueber die ganze Breite.
    const leiste = await page.getByTestId('tab-leiste').boundingBox()
    expect(leiste!.x).toBeLessThanOrEqual(0.5)
    expect(leiste!.width).toBeGreaterThanOrEqual(359.5)
  })
})
