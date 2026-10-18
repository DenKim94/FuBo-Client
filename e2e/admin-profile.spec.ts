import { expect, test, type Page } from '@playwright/test'
import { adminNachbilden, e2eProfil } from './hilfen/admin.js'
import { termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft die Profilverwaltung im echten Browser (C7, Stufe 2).
 *
 * Ohne Server: Sitzung (Admin) und Profile werden mit `page.route` nachgebildet. Geprueft wird,
 * was die Unit-Tests nicht sehen: den Weg ueber den echten Router, die tatsaechlich gesendeten
 * Koerper (alle Kategorien beim Anlegen, nur Geaendertes beim Bearbeiten) und den Platz auf dem Telefon.
 */

/** Hoehe, um die die Seite ueber das Fenster hinausragt (0 = kein Scrollen). */
async function ueberhangHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/** Meldet den Admin an und oeffnet die Liste. */
async function listeOeffnen(page: Page) {
  const welt = await adminNachbilden(page)
  await termineNachbilden(page, [])
  await page.goto('/admin/profile')
  await expect(page.getByTestId('admin-profile-anzahl')).toBeVisible()
  return welt
}

test.describe('Profilverwaltung', () => {
  test('zeigt die Spielerprofile ohne das Adminprofil mitzuzaehlen und kennzeichnet gesperrte und angemeldete', async ({ page }) => {
    await listeOeffnen(page)

    await expect(page.getByRole('heading', { level: 1, name: 'Spielerprofile' })).toBeVisible()
    await expect(page.getByTestId('admin-profile-anzahl')).toHaveText('3 Spielerprofile')
    await expect(page.getByTestId('profil-gesperrt-2')).toBeVisible()
    await expect(page.getByTestId('profil-online-3')).toBeVisible()
    await expect(page.getByTestId('profil-admin-99')).toBeVisible()
  })

  test('legt ein Profil an: alle Kategorien im Koerper, danach Liste mit Hinweis', async ({ page }) => {
    const welt = await listeOeffnen(page)

    await page.getByTestId('admin-profil-anlegen').click()
    await expect(page).toHaveURL(/\/admin\/profile\/neu$/)
    await expect(page.getByTestId('admin-profil-formular')).toBeVisible()
    // Vorbelegt mit der Mitte der Skala und sichtbar (nicht nur als Platzhalter).
    await expect(page.getByTestId('skill-ANGRIFF')).toHaveValue('3')
    await expect(page.getByTestId('skill-TORWART')).toHaveValue('2')

    await page.getByTestId('admin-profil-name').fill('  Beispielspieler 04  ')
    await page.getByTestId('skill-ANGRIFF').fill('5')
    await page.getByTestId('admin-profil-speichern').click()

    await expect(page).toHaveURL(/\/admin\/profile$/)
    await expect(page.getByTestId('admin-profile-hinweis')).toContainText('Beispielspieler 04')
    await expect(page.getByTestId('admin-profile-anzahl')).toHaveText('4 Spielerprofile')
    expect(welt.profilKoerper.angelegt).toEqual([
      { name: 'Beispielspieler 04', skills: { ANGRIFF: 5, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 } },
    ])
  })

  test('ein vergebener Name bleibt am Feld stehen, ohne die Seite zu verlassen', async ({ page }) => {
    const welt = await listeOeffnen(page)

    await page.goto('/admin/profile/neu')
    await page.getByTestId('admin-profil-name').fill('beispielspieler 01')
    await page.getByTestId('admin-profil-speichern').click()

    await expect(page.getByText('Dieser Name ist bereits vergeben.')).toBeVisible()
    await expect(page.getByTestId('admin-profil-name')).toBeFocused()
    await expect(page).toHaveURL(/\/admin\/profile\/neu$/)
    expect(welt.profile).toHaveLength(4)
  })

  test('der Speichern-Knopf nennt den Grund, solange der Name fehlt, und sendet nichts', async ({ page }) => {
    const welt = await listeOeffnen(page)

    await page.goto('/admin/profile/neu')
    await expect(page.getByTestId('admin-profil-grund')).toHaveText('Bitte gib einen Namen ein.')
    await page.getByTestId('admin-profil-speichern').click({ force: true })

    expect(welt.profilKoerper.angelegt).toHaveLength(0)
    await expect(page).toHaveURL(/\/admin\/profile\/neu$/)
  })

  test('bearbeitet ein Profil: gesendet wird nur, was sich geaendert hat', async ({ page }) => {
    const welt = await listeOeffnen(page)

    await page.getByTestId('profil-zeile-1').click()
    await expect(page).toHaveURL(/\/admin\/profile\/1$/)
    await expect(page.getByTestId('admin-profil-name')).toHaveValue('Beispielspieler 01')

    await page.getByTestId('skill-VERTEIDIGUNG').fill('6')
    await page.getByTestId('admin-profil-speichern').click()

    await expect(page.getByTestId('admin-profil-gespeichert')).toBeVisible()
    expect(welt.profilKoerper.bearbeitet).toEqual([{ spielerId: 1, skills: { VERTEIDIGUNG: 6 } }])
    expect(welt.profile[0]?.skills.VERTEIDIGUNG).toBe(6)

    // Nur der Name: keine Skillwerte im Koerper.
    await page.getByTestId('admin-profil-name').fill('Beispielspieler 10')
    await page.getByTestId('admin-profil-speichern').click()
    await expect.poll(() => welt.profilKoerper.bearbeitet.length).toBe(2)
    expect(welt.profilKoerper.bearbeitet[1]).toEqual({ spielerId: 1, name: 'Beispielspieler 10' })
  })

  test('sperrt und entsperrt ein Profil ohne Dialog; ein angemeldetes verlangt die Bestaetigung', async ({ page }) => {
    const welt = await listeOeffnen(page)

    // Nicht angemeldet: sofort, ohne Dialog.
    await page.goto('/admin/profile/1')
    await page.getByTestId('admin-profil-sperren').click()
    await expect(page.getByTestId('admin-profil-sperre-text')).toContainText('Gesperrt')
    await page.getByTestId('admin-profil-sperren').click()
    await expect(page.getByTestId('admin-profil-sperre-text')).toContainText('Aktiv')
    expect(welt.profilKoerper.blockiert).toEqual([
      { spielerId: 1, blockieren: true },
      { spielerId: 1, blockieren: false },
    ])

    // Angemeldet: erst nach der Bestaetigung.
    await page.goto('/admin/profile/3')
    await page.getByTestId('admin-profil-sperren').click()
    await expect(page.getByTestId('admin-profil-sperr-dialog')).toBeVisible()
    expect(welt.profilKoerper.blockiert).toHaveLength(2)
    await page.getByTestId('admin-profil-sperr-dialog-bestaetigen').click()
    await expect(page.getByTestId('admin-profil-sperre-text')).toContainText('Gesperrt')
    expect(welt.profilKoerper.blockiert[2]).toEqual({ spielerId: 3, blockieren: true })
  })

  test('entfernt ein Profil erst nach der Bestaetigung und geht mit Hinweis zur Liste', async ({ page }) => {
    const welt = await listeOeffnen(page)

    await page.goto('/admin/profile/1')
    await page.getByTestId('admin-profil-entfernen').click()
    await page.getByTestId('admin-profil-entfernen-dialog-abbrechen').click()
    expect(welt.profilKoerper.entfernt).toHaveLength(0)

    await page.getByTestId('admin-profil-entfernen').click()
    await page.getByTestId('admin-profil-entfernen-dialog-bestaetigen').click()

    await expect(page).toHaveURL(/\/admin\/profile$/)
    await expect(page.getByTestId('admin-profile-hinweis')).toContainText('Beispielspieler 01')
    await expect(page.getByTestId('profil-zeile-1')).toBeHidden()
    expect(welt.profilKoerper.entfernt).toEqual([{ spielerId: 1 }])
  })

  test('ein Profil mit Daten laesst sich nicht entfernen und bietet das Sperren an', async ({ page }) => {
    const welt = await listeOeffnen(page)
    welt.inVerwendung.add(1)

    await page.goto('/admin/profile/1')
    await page.getByTestId('admin-profil-entfernen').click()
    await page.getByTestId('admin-profil-entfernen-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-profil-in-verwendung')).toBeVisible()
    await expect(page.getByTestId('admin-profil-entfernen-dialog')).toBeHidden()
    await expect(page).toHaveURL(/\/admin\/profile\/1$/)

    await page.getByTestId('admin-profil-stattdessen-sperren').click()
    await expect(page.getByTestId('admin-profil-sperre-text')).toContainText('Gesperrt')
    expect(welt.profile.find((p) => p.spielerId === 1)?.aktiv).toBe(false)
  })

  test('das Adminprofil hat keine Aktionen und verweist auf den Anmeldenamen', async ({ page }) => {
    await listeOeffnen(page)

    await page.goto('/admin/profile/99')
    await expect(page.getByTestId('admin-profil-admin-hinweis')).toBeVisible()
    await expect(page.getByTestId('admin-profil-admin-namenlink')).toHaveAttribute('href', '/admin/name/aendern')
    await expect(page.getByTestId('admin-profil-sperren')).toBeHidden()
    await expect(page.getByTestId('admin-profil-entfernen')).toBeHidden()
    await expect(page.getByTestId('admin-profil-speichern')).toBeHidden()
  })

  test('eine ungueltige Id fuehrt zur Seite „nicht gefunden“', async ({ page }) => {
    await listeOeffnen(page)

    await page.goto('/admin/profile/abc')
    await expect(page.getByTestId('nicht-gefunden')).toBeVisible()
  })

  test('hat auf dem Telefon keinen waagerechten Ueberhang und Tap-Ziele von mindestens 44 px', async ({ page }) => {
    const welt = await listeOeffnen(page)
    welt.profile.splice(0, 0, e2eProfil({ spielerId: 7, name: 'Beispielspieler mit einem sehr langen Namen ohne Leerzeichen-Umbruch-Probe' }))
    await page.reload()
    await expect(page.getByTestId('profil-zeile-7')).toBeVisible()

    expect(await ueberhangHorizontal(page)).toBeLessThanOrEqual(0)
    for (const id of [1, 2, 3, 7]) {
      const kasten = await page.getByTestId(`profil-zeile-${String(id)}`).boundingBox()
      expect(kasten?.height ?? 0, `Zeile ${String(id)}`).toBeGreaterThanOrEqual(44)
    }

    await page.getByTestId('profil-zeile-1').click()
    await expect(page.getByTestId('admin-profil-formular')).toBeVisible()
    expect(await ueberhangHorizontal(page)).toBeLessThanOrEqual(0)
    for (const id of ['admin-profil-speichern', 'admin-profil-sperren', 'admin-profil-entfernen']) {
      const kasten = await page.getByTestId(id).boundingBox()
      expect(kasten?.height ?? 0, id).toBeGreaterThanOrEqual(44)
    }
  })

  test('ohne Sitzung bleibt die Profilverwaltung zu', async ({ page }) => {
    await page.goto('/admin/profile')
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
  })
})
