import { expect, test } from '@playwright/test'
import { adminStart as start, e2eProfil, ueberhangHorizontal } from './hilfen/admin.js'

/**
 * Prueft Gastplaetze, die Skill-Stufe eines Gastes und die manuelle Teamgenerierung im echten Browser (C8, Stufen 4 und 5)
 * auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung (Admin), Profile, Termine, Konfiguration und Gastplaetze sind mit `page.route` nachgebildet.
 * Geprueft werden die tatsaechlich gesendeten Koerper (`slotIds` statt `alle`; Gastname getrimmt, Stufe immer dabei), der
 * Hinweis, dass nichts gespeichert wird, und der Platz auf dem Telefon.
 */

test.describe('Gastplaetze', () => {
  test('zeigt die belegten Plaetze mit Zustand als Text; freie stehen nur in der Zusammenfassung', async ({ page }) => {
    await start(page, '/admin/gaeste')

    await expect(page.getByRole('heading', { level: 1, name: 'Gastplätze' })).toBeVisible()
    await expect(page.getByTestId('admin-gaeste-zusammenfassung')).toHaveText('2 von 4 Plätzen belegt')
    await expect(page.getByTestId('admin-gast-zustand-1')).toContainText('angemeldet')
    await expect(page.getByTestId('admin-gast-zustand-2')).toContainText('Sitzung abgelaufen')
    await expect(page.getByTestId('admin-gast-3')).toHaveCount(0)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('„Freigeben“ bei lebender Sitzung fragt nach und sendet slotIds; „Alle freigeben“ gibt es nicht', async ({ page }) => {
    const { welt } = await start(page, '/admin/gaeste')

    await page.getByTestId('admin-gast-freigeben-1').click()
    await expect(page.getByTestId('admin-gaeste-freigeben-dialog')).toContainText('Beispielgast wird sofort abgemeldet')
    await page.getByTestId('admin-gaeste-freigeben-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-gast-1')).toHaveCount(0)
    expect(welt.koerper.freigegeben).toEqual([{ slotIds: [1] }])
    await expect(page.getByText(/alle freigeben/i)).toHaveCount(0)
  })

  test('„Verwaiste freigeben“ gibt nur den verwaisten Platz frei, ohne Dialog, und laesst den lebenden unberuehrt', async ({ page }) => {
    const { welt } = await start(page, '/admin/gaeste')

    await page.getByTestId('admin-gaeste-verwaiste').click()

    await expect(page.getByTestId('admin-gast-2')).toHaveCount(0)
    await expect(page.getByTestId('admin-gast-1')).toBeVisible()
    expect(welt.koerper.freigegeben).toEqual([{ slotIds: [2] }])
    await expect(page.getByTestId('admin-gaeste-verwaiste')).toHaveCount(0)
  })

  test('Schaltflaechen sind mindestens 44 px hoch', async ({ page }) => {
    await start(page, '/admin/gaeste')

    for (const id of ['admin-gast-freigeben-1', 'admin-gaeste-verwaiste', 'admin-gaeste-aktualisieren']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('Skill-Stufe eines Gastes im Termin', () => {
  test('aendert die Stufe: Vorauswahl aus dem Gastplatz, Name unveraendert, Teilnehmerkreis zaehlt hoch', async ({ page }) => {
    const { welt, termine } = await start(page, '/admin/termine/1')

    await expect(page.getByTestId('admin-termin-gaeste-abschnitt')).toContainText('Beispielgast (Gast)')
    await page.getByTestId('admin-gast-stufe-8').click()
    await expect(page.getByTestId('admin-gast-stufe-wahl-STARK')).toBeChecked()
    await page.getByTestId('admin-gast-stufe-wahl-SCHWACH').check({ force: true })
    await page.getByTestId('admin-gast-stufe-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-gast-stufe-dialog')).toBeHidden()
    expect(welt.koerper.gastStufen).toEqual([{ terminId: 1, gastName: 'Beispielgast', stufe: 'SCHWACH' }])
    expect(termine.modelle[0].teilnehmerVersion).toBe(2)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })
})

/** Eine Karte mit Luecken, wie nach einem Datenimport (E7). */
const UNVOLLSTAENDIG = e2eProfil({ spielerId: 4, name: 'Beispielspieler 04', skills: { ANGRIFF: 4, VERTEIDIGUNG: 2, SPIELSTAERKE: 3 } })

test.describe('Manuelle Teamgenerierung', () => {
  test('zeigt den Hinweis vor der Auswahl; das unvollstaendige Profil ist gesperrt mit Grund, Gesperrte und Admin fehlen', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 }, zusatzProfile: [UNVOLLSTAENDIG] })

    await expect(page.getByRole('heading', { level: 1, name: 'Teams ohne Termin' })).toBeVisible()
    await expect(page.getByTestId('teams-manuell-hinweis')).toContainText('wird nicht gespeichert')
    await expect(page.getByTestId('admin-teams-profil-4')).toBeDisabled()
    await expect(page.getByTestId('admin-teams-unvollstaendig-4')).toHaveText('Skillwerte unvollständig')
    await expect(page.getByTestId('admin-teams-profil-2')).toHaveCount(0)
    await expect(page.getByTestId('admin-teams-profil-99')).toHaveCount(0)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('berechnet fuer Profile und einen Gast: Koerper, Ergebnis mit Hinweis, Ungleichgewicht, Fokus auf der Ueberschrift', async ({ page }) => {
    const { welt } = await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 } })

    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await page.getByTestId('admin-teams-gast-hinzufuegen').click()
    await page.getByTestId('admin-teams-gast-name-1').fill('  Beispielgast  ')
    await page.getByTestId('admin-teams-gast-stufe-1-STARK').check()
    await expect(page.getByTestId('admin-teams-gast-stufe-1-STARK')).toBeChecked()
    await page.getByTestId('admin-teams-berechnen').click()

    const ergebnis = page.getByTestId('admin-teams-ergebnis')
    await expect(ergebnis).toBeVisible()
    expect(welt.koerper.teamsManuell).toEqual([{ spielerIds: [1, 3], gaeste: [{ stufe: 'STARK', name: 'Beispielgast' }] }])
    await expect(ergebnis.getByRole('heading', { level: 2, name: 'Ergebnis' })).toBeFocused()
    await expect(page.getByTestId('teams-manuell-hinweis-ergebnis')).toContainText('wird nicht gespeichert')
    await expect(page.getByTestId('admin-teams-ergebnis-teams-b')).toContainText('Beispielgast (Gast)')
    await expect(page.getByTestId('admin-teams-ungleichgewicht')).toHaveText('Ungleichgewicht: 1,25')
    await expect(page.getByTestId('admin-teams-verfahren')).toHaveText('Gerechnet mit: Exakt.')
    // Keine Skillwerte im Ergebnis.
    await expect(ergebnis).not.toContainText(/Angriff|Verteidigung|Torwart/)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('weicht die Regel des Servers von der Einstellung ab, steht der Erklaersatz da', async ({ page }) => {
    await start(page, '/admin/teams', {
      konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4, auswechselModus: 'ZULETZT_ANGEMELDET' },
    })

    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await page.getByTestId('admin-teams-berechnen').click()

    await expect(page.getByTestId('admin-teams-regel-abweichung')).toContainText('keine Anmeldereihenfolge')
  })

  test('jede Aenderung der Auswahl laesst das Ergebnis verschwinden (M12); „Erneut berechnen“ sendet dieselbe Auswahl', async ({ page }) => {
    const { welt } = await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 } })
    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await page.getByTestId('admin-teams-berechnen').click()
    await expect(page.getByTestId('admin-teams-ergebnis')).toBeVisible()

    await page.getByTestId('admin-teams-erneut').click()
    await expect.poll(() => welt.koerper.teamsManuell.length).toBe(2)
    expect(welt.koerper.teamsManuell[1]).toEqual(welt.koerper.teamsManuell[0])

    await page.getByTestId('admin-teams-profil-3').uncheck()
    await expect(page.getByTestId('admin-teams-ergebnis')).toHaveCount(0)
  })

  test('ausserhalb der Grenzen ist „Teams berechnen“ gesperrt (mit Grund), ein Tipp sendet nichts', async ({ page }) => {
    const { welt } = await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 } })
    const knopf = page.getByTestId('admin-teams-berechnen')

    await expect(knopf).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('admin-teams-grund')).toHaveText('Bitte wähle Spieler oder füge Gäste hinzu.')
    await expect(page.getByTestId('admin-teams-zaehler')).toHaveText('Ausgewählt: 0. Erlaubt: 2 bis 4.')
    await knopf.click({ force: true })

    await expect(page.getByTestId('admin-teams-ergebnis')).toHaveCount(0)
    expect(welt.koerper.teamsManuell).toEqual([])
  })

  test('ein Gast laesst sich entfernen (Fokus auf „Gast hinzufuegen“); Tap-Ziele sind mindestens 44 px hoch, die Leiste verdeckt nichts', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 8 } })
    for (let i = 0; i < 4; i += 1) await page.getByTestId('admin-teams-gast-hinzufuegen').click()

    await page.getByTestId('admin-teams-gast-entfernen-4').click()
    await expect(page.getByTestId('admin-teams-gast-4')).toHaveCount(0)
    await expect(page.getByTestId('admin-teams-gast-hinzufuegen')).toBeFocused()

    for (const id of ['admin-teams-gast-hinzufuegen', 'admin-teams-gast-entfernen-1', 'admin-teams-berechnen']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44)
    }
    // Das letzte Bedienelement liegt ueber der haftenden Leiste, nicht darunter.
    const hinzufuegen = page.getByTestId('admin-teams-gast-hinzufuegen')
    await hinzufuegen.scrollIntoViewIfNeeded()
    const knopf = await hinzufuegen.boundingBox()
    const leiste = await page.getByTestId('admin-teams-zaehler').boundingBox()
    expect((knopf?.y ?? 0) + (knopf?.height ?? 0)).toBeLessThanOrEqual(leiste?.y ?? 0)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })
})
