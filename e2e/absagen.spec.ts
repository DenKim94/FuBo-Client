import { expect, test, type Page } from '@playwright/test'
import { adminStart } from './hilfen/admin.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { EIGENER_NAME, terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Absagen unter der Teilnehmerliste (Vertrag vom 06.11.2026) in allen vier Ansichten mit `TerminAnsicht`:
 * Dashboard und Termin-Ansicht des Spielers, Dashboard und Termin-Verwaltung des Admins.
 */

const ANDERE = [
  { name: 'Zora', gast: false },
  { name: 'Anton', gast: false },
]

/** Die Absagenliste steht direkt unter der Teilnehmerliste, gleich breit, ohne seitlichen Überhang. */
async function lagePruefen(page: Page) {
  const lage = await page.evaluate(() => {
    const rechteck = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()
    const zusagen = rechteck('teilnehmerliste')
    const absagen = rechteck('absagenliste')
    const kopf = rechteck('absagenliste-summary')
    return {
      darunter: absagen.top >= zusagen.bottom,
      abstand: Math.round(absagen.top - zusagen.bottom),
      gleichBreit: Math.abs(absagen.width - zusagen.width) < 1 && Math.abs(absagen.left - zusagen.left) < 1,
      kopfHoehe: kopf.height,
      ueberhang: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
  expect(lage.darunter).toBe(true)
  expect(lage.abstand).toBeLessThanOrEqual(24)
  expect(lage.gleichBreit).toBe(true)
  expect(lage.kopfHoehe).toBeGreaterThanOrEqual(44)
  expect(lage.ueberhang).toBe(0)
}

test.describe('Absagen (Spieler)', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('Dashboard: eingeklappt unter den Zusagen; nach „Ich kann nicht“ steht die eigene Absage darin', async ({ page }) => {
    await termineNachbilden(page, [terminModell({ terminId: 102, absagen: ANDERE })])
    await page.goto('/')

    const absagen = page.getByTestId('absagenliste')
    await expect(page.getByTestId('absagenliste-summary')).toHaveText('Absagen (2)')
    await expect(absagen).not.toHaveAttribute('open', '')
    await lagePruefen(page)

    await page.getByTestId('rueckmeldung-absagen').click()
    await expect(page.getByTestId('absagenliste-summary')).toHaveText('Absagen (3)')
    await page.getByTestId('absagenliste-summary').click()
    await expect(absagen.getByRole('listitem')).toHaveText(['Anton', `${EIGENER_NAME} (du)`, 'Zora'])
  })

  test('Termin-Ansicht: offen wie die Teilnehmerliste; ohne Absagen ein Satz und kein Pfeil', async ({ page }) => {
    await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/termine/102')

    await expect(page.getByTestId('absagenliste')).toHaveAttribute('open', '')
    await expect(page.getByTestId('absagenliste-summary')).toHaveText('Absagen (0)')
    await expect(page.getByTestId('absagenliste-leer')).toHaveText('Bisher hat niemand abgesagt.')
    await expect(page.getByTestId('absagenliste-pfeil')).toHaveCount(0)
    await lagePruefen(page)
  })
})

test.describe('Absagen (Admin)', () => {
  test('Admin-Dashboard: eingeklappt unter den Zusagen, aufklappbar mit Namen', async ({ page }) => {
    await adminStart(page, '/admin', { modelle: [terminModell({ terminId: 1, absagen: [...ANDERE, { name: 'Beispielgast 2', gast: true }] })] })

    await expect(page.getByTestId('absagenliste-summary')).toHaveText('Absagen (3)')
    await expect(page.getByTestId('absagenliste')).not.toHaveAttribute('open', '')
    await lagePruefen(page)
    await page.getByTestId('absagenliste-summary').click()
    await expect(page.getByTestId('absagenliste').getByRole('listitem')).toHaveText(['Anton', 'Beispielgast 2 (Gast)', 'Zora'])
  })

  test('Admin-Dashboard ohne Zusagen und Absagen: zwei gleich gestaltete Sätze (06.11.2026)', async ({ page }) => {
    await adminStart(page, '/admin', { modelle: [terminModell({ terminId: 1, zusagen: [] })] })
    await page.getByTestId('teilnehmerliste-summary').click()
    await page.getByTestId('absagenliste-summary').click()

    await expect(page.getByTestId('teilnehmerliste-leer')).toHaveText('Bisher hat niemand zugesagt.')
    await expect(page.getByTestId('absagenliste-leer')).toHaveText('Bisher hat niemand abgesagt.')
    const stil = (id: string) =>
      page.getByTestId(id).evaluate((e) => {
        const s = getComputedStyle(e)
        return [s.fontSize, s.color, s.paddingTop, s.paddingLeft, s.borderTopWidth, s.borderTopColor].join(' ')
      })
    expect(await stil('teilnehmerliste-leer')).toBe(await stil('absagenliste-leer'))
  })

  test('Termin-Verwaltung: offen unter den Zusagen', async ({ page }) => {
    await adminStart(page, '/admin/termine/1', { modelle: [terminModell({ terminId: 1, absagen: ANDERE })] })

    await expect(page.getByTestId('absagenliste')).toHaveAttribute('open', '')
    await expect(page.getByTestId('absagenliste').getByRole('listitem')).toHaveText(['Anton', 'Zora'])
    await lagePruefen(page)
  })
})
