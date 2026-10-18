import { expect, test, type Page } from '@playwright/test'
import { adminNachbilden } from './hilfen/admin.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft das Admin-Dashboard im echten Browser (C7, Stufe 1).
 *
 * Ohne Server: Sitzung (Admin) und Termine werden mit `page.route` nachgebildet.
 * Geprueft wird, was die Unit-Tests nicht sehen: Platz und Tap-Ziele auf dem Telefon,
 * die Navigation ueber den echten Router und dass der Admin nur lesend sieht.
 */

/** Hoehe, um die die Seite ueber das Fenster hinausragt (0 = kein Scrollen). */
async function ueberhangHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test.describe('Admin-Dashboard', () => {
  test('zeigt den naechsten Termin nur lesend und die Verwaltungsliste', async ({ page }) => {
    await adminNachbilden(page)
    const welt = await termineNachbilden(page, [terminModell({ terminId: 41 }), terminModell({ terminId: 42, datum: '2099-01-20' })])
    await page.goto('/admin')

    await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible()
    await expect(page.getByTestId('teilnehmerliste')).toBeVisible()
    // E2: Der Admin kann weder zu- noch absagen.
    await expect(page.getByTestId('rueckmeldung-zusagen')).toBeHidden()
    await expect(page.getByTestId('rueckmeldung-absagen')).toBeHidden()
    await expect(page.getByTestId('admin-termin-verwalten-link')).toHaveAttribute('href', '/admin/termine/41')
    // E1: Die Liste ist die Navigation, keine Tab-Leiste.
    await expect(page.getByTestId('tab-leiste')).toBeHidden()
    for (const id of ['profile', 'termine', 'gaeste', 'konfiguration', 'teams', 'pin', 'name', 'passwort']) {
      await expect(page.getByTestId(`admin-link-${id}`)).toBeVisible()
    }
    expect(welt.rueckmeldungen).toHaveLength(0)
  })

  test('zeigt ohne Termin den Leerzustand und laesst die Verwaltung erreichbar', async ({ page }) => {
    await adminNachbilden(page)
    await termineNachbilden(page, [])
    await page.goto('/admin')

    await expect(page.getByTestId('admin-dashboard-leer')).toBeVisible()
    await expect(page.getByTestId('admin-termin-anlegen-link')).toHaveAttribute('href', '/admin/termine/neu')
    await expect(page.getByTestId('admin-link-pin')).toBeVisible()
  })

  test('ein Fehler beim Laden der Termine blockiert die Verwaltung nicht', async ({ page }) => {
    await adminNachbilden(page)
    await page.route('**/api/v1/termine/lesen', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', status: 500, code: 'INTERNER_FEHLER', detail: 'Interner Fehler.' },
      }),
    )
    await page.goto('/admin')

    await expect(page.getByTestId('admin-dashboard-fehler')).toBeVisible()
    await expect(page.getByTestId('admin-link-pin')).toBeVisible()
  })

  test('fuehrt ueber die Liste zur PIN und mit „Zurueck“ zur Administration', async ({ page }) => {
    await adminNachbilden(page)
    await termineNachbilden(page, [terminModell({ terminId: 41 })])
    await page.goto('/admin')

    await page.getByTestId('admin-link-pin').click()
    await expect(page).toHaveURL(/\/admin\/pin$/)
    await expect(page.getByTestId('admin-pin')).toBeVisible()

    await page.getByTestId('layout-zurueck').click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByTestId('admin-dashboard')).toBeVisible()
  })

  test('hat auf dem Telefon keinen waagerechten Ueberhang und Tap-Ziele von mindestens 44 px', async ({ page }) => {
    await adminNachbilden(page)
    await termineNachbilden(page, [terminModell({ terminId: 41 })])
    await page.goto('/admin')
    await expect(page.getByTestId('admin-link-passwort')).toBeVisible()

    expect(await ueberhangHorizontal(page)).toBeLessThanOrEqual(0)
    for (const id of ['profile', 'termine', 'gaeste', 'konfiguration', 'teams', 'pin', 'name', 'passwort']) {
      const kasten = await page.getByTestId(`admin-link-${id}`).boundingBox()
      expect(kasten?.height ?? 0, `Tap-Ziel ${id}`).toBeGreaterThanOrEqual(44)
    }
  })

  test('ohne Sitzung bleibt der Adminbereich zu', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('admin-dashboard')).toBeHidden()
  })
})
