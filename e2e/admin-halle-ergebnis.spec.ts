import { expect, test } from '@playwright/test'
import { adminStart as start, ueberhangHorizontal } from './hilfen/admin.js'
import { einteilungAus, terminModell, type TerminModell } from './hilfen/termine.js'

/**
 * Prueft Hallenabsage und Ergebniskorrektur im echten Browser (C8, Stufe 5) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung (Admin), Termine und Konfiguration sind mit `page.route` nachgebildet; es geht **keine** echte
 * E-Mail hinaus. Geprueft wird, was die Unit-Tests nicht sehen: der Weg ueber den echten Router und den echten Dialog,
 * die tatsaechlich gesendeten Koerper, die Doppelabsage („schon raus“), der Ausfall des Versands (`503`), der Konflikt
 * `DATEN_VERALTET` bei der Korrektur und der Platz auf dem Telefon.
 */

const HALLE = { hallenModusAktiv: true, halleEmail: 'halle@beispiel.example' }

/** Abgeschlossener Termin 1 mit Ergebnis (Team A, deutlich) und Einteilung. */
function abgeschlossen(): TerminModell {
  const modell = terminModell({
    terminId: 1,
    datum: '2099-01-13',
    status: 'ABGESCHLOSSEN',
    ergebnis: {
      sieger: 'A',
      deutlich: true,
      erfasstVon: 'Beispielspieler 11',
      erfasstAm: '2099-01-13T21:00:00Z',
      korrigiertAm: null,
      version: 1,
    },
  })
  modell.teams = einteilungAus(modell)
  return modell
}

test.describe('Hallenabsage', () => {
  test('sagt den Termin per E-Mail ab: Dialog warnt, Koerper, Termin ABGESAGT, Zeitpunkt statt Aktion, Fokus auf der Ueberschrift', async ({ page }) => {
    const { welt, termine } = await start(page, '/admin/termine/1', { konfiguration: HALLE })

    await expect(page.getByTestId('admin-halle-moeglich')).toContainText('Absage möglich bis 13.01., 19:00 Uhr.')
    await page.getByTestId('admin-halle-absagen').click()
    await expect(page.getByTestId('admin-halle-dialog')).toContainText('lässt sich nicht zurücknehmen')
    await page.getByTestId('admin-halle-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-halle-versandt')).toContainText('wurde am')
    expect(welt.koerper.halleAbgesagt).toEqual([{ terminId: 1 }])
    expect(termine.modelle[0].status).toBe('ABGESAGT')
    await expect(page.getByTestId('admin-halle-absagen')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('war jemand schneller, steht „Die Absage ist schon raus.“ da, ohne Fehler', async ({ page }) => {
    const { termine } = await start(page, '/admin/termine/1', { konfiguration: HALLE })
    await expect(page.getByTestId('admin-halle-moeglich')).toBeVisible()
    termine.modelle[0].halleAbgesagtAm = '2099-01-02T10:00:00Z'

    await page.getByTestId('admin-halle-absagen').click()
    await page.getByTestId('admin-halle-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-halle-nachricht')).toHaveText('Die Absage ist schon raus.')
    await expect(page.getByTestId('admin-halle-versandt')).toBeVisible()
    await expect(page.getByTestId('admin-halle-dialog')).toBeHidden()
  })

  test('faellt der Versand aus (503), bleibt der Dialog offen und nichts aendert sich; von Hand klappt der zweite Versuch', async ({ page }) => {
    const { welt, termine } = await start(page, '/admin/termine/1', { konfiguration: HALLE })
    welt.mailFehler = true

    await page.getByTestId('admin-halle-absagen').click()
    await page.getByTestId('admin-halle-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-halle-dialog-versand')).toHaveText('Es wurde nichts verändert; du kannst es erneut versuchen.')
    await expect(page.getByTestId('admin-halle-dialog')).toBeVisible()
    expect(termine.modelle[0].status).toBe('GEPLANT')
    expect(welt.koerper.halleAbgesagt).toHaveLength(1)

    welt.mailFehler = false
    await page.getByTestId('admin-halle-dialog-bestaetigen').click()
    await expect(page.getByTestId('admin-halle-versandt')).toBeVisible()
    expect(welt.koerper.halleAbgesagt).toHaveLength(2)
  })

  test('ist die Frist erreicht, ist die Aktion gesperrt (mit Grund), ein Tipp oeffnet nichts; der Rest der Verwaltung bleibt nutzbar', async ({ page }) => {
    const { welt } = await start(page, '/admin/termine/1', {
      konfiguration: HALLE,
      modelle: [terminModell({ terminId: 1, datum: '2099-01-13', halleAbsageMoeglichBis: '2020-01-01T10:00:00' })],
    })

    await expect(page.getByTestId('admin-halle-frist')).toContainText('Die Frist für die Hallenabsage ist abgelaufen')
    const knopf = page.getByTestId('admin-halle-absagen')
    await expect(knopf).toHaveAttribute('aria-disabled', 'true')
    await knopf.click({ force: true })

    await expect(page.getByTestId('admin-halle-dialog')).toBeHidden()
    expect(welt.koerper.halleAbgesagt).toEqual([])
    await expect(page.getByTestId('admin-termin-absagen')).toBeVisible()
  })

  test('ohne Adresse fuehrt der Link in die Konfiguration', async ({ page }) => {
    await start(page, '/admin/termine/1', { konfiguration: { hallenModusAktiv: true } })

    await expect(page.getByTestId('admin-halle-adresse-fehlt')).toContainText('keine E-Mail-Adresse')
    await expect(page.getByTestId('admin-halle-absagen')).toHaveAttribute('aria-disabled', 'true')
    await page.getByTestId('admin-halle-zur-konfiguration').click()

    await expect(page).toHaveURL(/\/admin\/konfiguration$/)
  })

  test('bei ausgeschaltetem Hallenmodus gibt es den Abschnitt nicht', async ({ page }) => {
    await start(page, '/admin/termine/1')

    await expect(page.getByTestId('admin-termin-verwaltung')).toBeVisible()
    await expect(page.getByTestId('admin-halle-abschnitt')).toHaveCount(0)
  })

  test('bei abgeschlossenem Termin gibt es den Abschnitt nicht, auch bei aktivem Hallenmodus', async ({ page }) => {
    await start(page, '/admin/termine/1', { konfiguration: HALLE, modelle: [abgeschlossen()] })

    await expect(page.getByTestId('admin-ergebnis-abschnitt')).toBeVisible()
    await expect(page.getByTestId('admin-halle-abschnitt')).toHaveCount(0)
  })

  test('die Aktion ist mindestens 44 px hoch', async ({ page }) => {
    await start(page, '/admin/termine/1', { konfiguration: HALLE })

    const box = await page.getByTestId('admin-halle-absagen').boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  })
})

test.describe('Ergebniskorrektur', () => {
  test('zeigt das Ergebnis; „Speichern“ ist ohne Aenderung gesperrt; mit Aenderung fragt die Bestaetigung mit Alt und Neu', async ({ page }) => {
    const { welt } = await start(page, '/admin/termine/1', { modelle: [abgeschlossen()] })

    await expect(page.getByTestId('ergebnis-anzeige-satz')).toHaveText('Team A hat deutlich gewonnen.')
    await page.getByTestId('admin-ergebnis-korrigieren').click()
    const speichern = page.getByTestId('admin-ergebnis-speichern')
    await expect(speichern).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('admin-ergebnis-grund')).toHaveText('Es gibt keine Änderung.')
    await speichern.click({ force: true })
    await expect(page.getByTestId('admin-ergebnis-dialog')).toBeHidden()

    await page.getByTestId('ergebnis-sieger-b').check({ force: true })
    await speichern.click()
    await expect(page.getByTestId('admin-ergebnis-zusammenfassung')).toContainText(
      'von „Team A hat deutlich gewonnen.“ auf „Team B hat deutlich gewonnen.“',
    )
    expect(welt.koerper.ergebnisKorrigiert).toEqual([])
  })

  test('korrigiert auf Unentschieden: deutlich geht als false hinaus, „Ergebnis korrigiert.“ steht da, der Fokus liegt auf der Ueberschrift', async ({ page }) => {
    const { welt } = await start(page, '/admin/termine/1', { modelle: [abgeschlossen()] })

    await page.getByTestId('admin-ergebnis-korrigieren').click()
    await page.getByTestId('ergebnis-sieger-u').check({ force: true })
    await expect(page.getByTestId('ergebnis-deutlich')).toBeDisabled()
    await page.getByTestId('admin-ergebnis-speichern').click()
    await page.getByTestId('admin-ergebnis-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-ergebnis-korrigiert')).toHaveText('Ergebnis korrigiert.')
    expect(welt.koerper.ergebnisKorrigiert).toEqual([{ terminId: 1, sieger: 'U', deutlich: false, version: 1 }])
    await expect(page.getByTestId('ergebnis-anzeige-satz')).toHaveText('Unentschieden.')
    await expect(page.getByTestId('ergebnis-anzeige-titel')).toBeFocused()
    await expect(page.getByTestId('ergebnis-anzeige-korrigiert')).toBeVisible()
  })

  test('DATEN_VERALTET: das Formular steht mit dem frischen Stand da, der Text erklaert es, die alten Eingaben gehen nicht mit neuer Version hinaus', async ({ page }) => {
    const { welt } = await start(page, '/admin/termine/1', { modelle: [abgeschlossen()] })
    await page.getByTestId('admin-ergebnis-korrigieren').click()
    await page.getByTestId('ergebnis-sieger-b').check({ force: true })
    welt.fremdeErgebnisAenderung(1, { sieger: 'U', deutlich: false })

    await page.getByTestId('admin-ergebnis-speichern').click()
    await page.getByTestId('admin-ergebnis-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-ergebnis-veraltet')).toContainText('zwischenzeitlich korrigiert')
    await expect(page.getByTestId('ergebnis-sieger-u')).toBeChecked()
    await expect(page.getByTestId('ergebnis-sieger-b')).not.toBeChecked()
    expect(welt.koerper.ergebnisKorrigiert).toEqual([{ terminId: 1, sieger: 'B', deutlich: true, version: 1 }])
  })

  test('der Admin erfasst kein Ergebnis: ohne Ergebnis steht nur der Hinweis', async ({ page }) => {
    const modell = abgeschlossen()
    modell.ergebnis = null
    await start(page, '/admin/termine/1', { modelle: [modell] })

    await expect(page.getByTestId('admin-ergebnis-leer')).toContainText('Das erfassen die Spieler.')
    await expect(page.getByTestId('admin-ergebnis-korrigieren')).toHaveCount(0)
  })

  test('die Aktionen sind mindestens 44 px hoch und die Seite scrollt nicht seitlich', async ({ page }) => {
    await start(page, '/admin/termine/1', { modelle: [abgeschlossen()] })

    const korrigieren = await page.getByTestId('admin-ergebnis-korrigieren').boundingBox()
    expect(korrigieren?.height ?? 0).toBeGreaterThanOrEqual(44)
    await page.getByTestId('admin-ergebnis-korrigieren').click()
    for (const id of ['admin-ergebnis-speichern', 'admin-ergebnis-abbrechen']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box?.height ?? 0, id).toBeGreaterThanOrEqual(44)
    }
    expect(await ueberhangHorizontal(page)).toBe(0)
  })
})
