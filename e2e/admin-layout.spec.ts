import { expect, test } from '@playwright/test'
import { adminNachbilden, terminverwaltungNachbilden } from './hilfen/admin.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft in einer Schleife ueber alle Admin-Seiten (C7, Abnahme 11.2), dass bei 360 px nichts seitlich scrollt.
 *
 * Die Breite wird fest auf 360 x 780 gesetzt, in jedem Geraeteprojekt; die einzelnen Specs pruefen daneben
 * Tap-Ziele und Sichtbarkeit der Aktionen. Ohne Server: Sitzung (Admin), Profile und Termine sind nachgebildet.
 */

const PFADE = [
  '/admin',
  '/admin/pin',
  '/admin/name/aendern',
  '/admin/name/bestaetigen',
  '/admin/passwort/aendern',
  '/admin/profile',
  '/admin/profile/neu',
  '/admin/profile/1',
  '/admin/profile/1/bearbeiten',
  '/admin/profile/2',
  '/admin/profile/99',
  '/admin/termine',
  '/admin/termine/neu',
  '/admin/termine/1',
  '/admin/termine/2',
  '/admin/gaeste',
  '/admin/konfiguration',
  '/admin/teams',
]

test.describe('Layout der Admin-Seiten bei 360 x 780', () => {
  test('keine Seite scrollt seitlich', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await adminNachbilden(page)
    const termine = await termineNachbilden(page, [
      terminModell({ terminId: 1, datum: '2099-01-13', uhrzeit: '19:00:00' }),
      terminModell({ terminId: 2, datum: '2099-01-20', uhrzeit: '19:00:00', zusagen: [], status: 'ABGESAGT' }),
    ])
    await terminverwaltungNachbilden(page, termine)

    for (const pfad of PFADE) {
      await page.goto(pfad)
      // Die Seite hat gerendert, wenn der Hauptbereich einen Inhalt hat (nicht nur den Startlader).
      await expect(page.locator('main')).not.toBeEmpty()
      await page.waitForLoadState('networkidle')
      const ueberhang = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(ueberhang, pfad).toBeLessThanOrEqual(0)
    }
  })
})
