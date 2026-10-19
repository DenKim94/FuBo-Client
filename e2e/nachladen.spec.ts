import { expect, test, type Page } from '@playwright/test'
import { adminNachbilden } from './hilfen/admin.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft das Nachladen des Admin-Bereichs (Lazy Routes, 18.10.2026) im gebauten Client.
 *
 * Gezaehlt werden nur Anfragen der Seite (`page.on('request')`), nicht die des Service Workers: Der laedt beim
 * Installieren alle Pakete in den Precache, auch das Admin-Paket – im Hintergrund, nicht beim Seitenaufbau.
 */

/** Sammelt die Adressen der JavaScript-Pakete, die die Seite anfordert. */
function paketeMitschneiden(page: Page): string[] {
  const pakete: string[] = []
  page.on('request', (anfrage) => {
    const adresse = anfrage.url()
    if (adresse.includes('/assets/') && adresse.endsWith('.js')) pakete.push(adresse)
  })
  return pakete
}

test.describe('Nachladen des Admin-Bereichs', () => {
  test('ein Spieler laedt das Admin-Paket nie, auch nicht beim Wechsel der Bereiche', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    await termineNachbilden(page, [terminModell({ terminId: 102 })])
    const pakete = paketeMitschneiden(page)

    await page.goto('/')
    await expect(page.getByTestId('tab-leiste')).toBeVisible()
    for (const tab of ['tab-teams', 'tab-ergebnisse', 'tab-verlauf', 'tab-termine']) {
      await page.getByTestId(tab).click()
    }

    expect(pakete.length).toBeGreaterThan(0)
    expect(pakete.filter((p) => p.includes('adminSeiten'))).toHaveLength(0)
  })

  test('der Direktaufruf einer Admin-Adresse laedt das Paket einmal; Wechsel im Bereich laden nichts nach', async ({ page }) => {
    await adminNachbilden(page)
    await termineNachbilden(page, [terminModell({ terminId: 41 })])
    const pakete = paketeMitschneiden(page)

    await page.goto('/admin')
    await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible()
    expect(pakete.filter((p) => p.includes('adminSeiten'))).toHaveLength(1)

    const vorher = pakete.length
    await page.getByTestId('admin-link-profile').click()
    await expect(page).toHaveURL(/\/admin\/profile$/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(pakete.length).toBe(vorher)
  })
})
