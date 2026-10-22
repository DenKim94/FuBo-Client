import { expect, test } from '@playwright/test'
import { adminStart as start, ueberhangHorizontal } from './hilfen/admin.js'

/**
 * Prueft die Konfiguration im echten Browser (C8, Stufe 4) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung (Admin), Termine und Konfiguration sind mit `page.route` nachgebildet. Geprueft wird, was die
 * Unit-Tests nicht sehen: der Weg ueber den echten Router, der tatsaechlich gesendete Koerper (Voll-Update mit genau
 * fuenfzehn Schluesseln), der Konflikt `DATEN_VERALTET` und der Platz auf dem Telefon. Gastplaetze, Gast-Stufe und die
 * manuelle Generierung stehen in `admin-gaeste-teams.spec.ts`, Hallenabsage und Ergebniskorrektur in
 * `admin-halle-ergebnis.spec.ts`.
 */

test.describe('Konfiguration', () => {
  test('zeigt den Stand, speichert ein Voll-Update mit fuenfzehn Schluesseln und meldet „Gespeichert.“', async ({ page }) => {
    const { welt } = await start(page, '/admin/konfiguration')

    await expect(page.getByRole('heading', { level: 1, name: 'Konfiguration' })).toBeVisible()
    await expect(page.getByTestId('admin-konfig-anzGuests')).toHaveValue('4')
    expect(await ueberhangHorizontal(page)).toBe(0)

    await page.getByTestId('admin-konfig-anzGuests').fill('6')
    await page.getByTestId('admin-konfig-speichern').click()

    await expect(page.getByTestId('admin-konfig-gespeichert')).toBeVisible()
    expect(welt.koerper.geaendert).toHaveLength(1)
    expect(Object.keys(welt.koerper.geaendert[0])).toHaveLength(15)
    expect(welt.koerper.geaendert[0]).toMatchObject({ version: 1, anzGuests: 6, halleEmail: null, halleAbsageVorlage: null })
    expect(welt.konfiguration.anzGuests).toBe(6)
    // Lesen im Admin ohne Kopf X-FuBo-Kein-Refresh.
    expect(welt.abrufe.konfiguration.every((kopf) => kopf === null)).toBe(true)
  })

  test('„Speichern“ ist ohne Aenderung gesperrt (mit Grund) und erreichbar, die haftende Leiste verdeckt kein Feld', async ({ page }) => {
    await start(page, '/admin/konfiguration')

    const speichern = page.getByTestId('admin-konfig-speichern')
    await expect(speichern).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('admin-konfig-grund')).toHaveText('Es gibt keine Änderung.')
    const box = await speichern.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)

    // Das letzte Feld laesst sich bis ueber die Leiste scrollen und bedienen.
    const letztes = page.getByTestId('admin-konfig-pushErinnerungStunden')
    await letztes.scrollIntoViewIfNeeded()
    await letztes.fill('12')
    await expect(speichern).not.toHaveAttribute('aria-disabled', 'true')
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('ein ungueltiger Wert wird nicht gesendet, der Fehler steht am Feld', async ({ page }) => {
    const { welt } = await start(page, '/admin/konfiguration')

    await page.getByTestId('admin-konfig-anzGuests').fill('99')
    await page.getByTestId('admin-konfig-speichern').click()

    await expect(page.getByTestId('admin-konfig-anzGuests-fehler')).toContainText('von 0 bis 22')
    await expect(page.getByTestId('admin-konfig-anzGuests')).toBeFocused()
    expect(welt.koerper.geaendert).toHaveLength(0)
  })

  test('DATEN_VERALTET: Hinweis und frischer Stand, die alten Eingaben werden nicht mit neuer Version gesendet', async ({ page }) => {
    const { welt } = await start(page, '/admin/konfiguration')
    await expect(page.getByTestId('admin-konfig-anzGuests')).toHaveValue('4')

    await page.getByTestId('admin-konfig-anzGuests').fill('6')
    welt.fremdeAenderung({ pushErinnerungStunden: 12 })
    await page.getByTestId('admin-konfig-speichern').click()

    await expect(page.getByTestId('admin-konfig-veraltet')).toBeVisible()
    await expect(page.getByTestId('admin-konfig-pushErinnerungStunden')).toHaveValue('12')
    await expect(page.getByTestId('admin-konfig-anzGuests')).toHaveValue('4')
    expect(welt.koerper.geaendert).toHaveLength(1)
    expect(welt.konfiguration.anzGuests).toBe(4)
  })

  test('die Warnung bei kurzem Leerlauf sperrt das Speichern nicht', async ({ page }) => {
    const { welt } = await start(page, '/admin/konfiguration')

    await page.getByTestId('admin-konfig-sessionLeerlaufMinuten').fill('3')
    await expect(page.getByTestId('admin-konfig-leerlauf-warnung')).toBeVisible()
    await page.getByTestId('admin-konfig-speichern').click()

    await expect(page.getByTestId('admin-konfig-gespeichert')).toBeVisible()
    expect(welt.konfiguration.sessionLeerlaufMinuten).toBe(3)
  })
})
