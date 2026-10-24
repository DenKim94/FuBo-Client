import { expect, test, type Page } from '@playwright/test'
import { adminNachbilden, terminverwaltungNachbilden } from './hilfen/admin.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft die Terminverwaltung im echten Browser (C7, Stufe 3) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung (Admin) und Termine sind mit `page.route` nachgebildet. Geprueft wird, was die
 * Unit-Tests nicht sehen: den Weg ueber den echten Router, die tatsaechlich gesendeten Koerper (nur
 * Geaendertes samt `version`), den Konflikt `DATEN_VERALTET` und den Platz auf dem Telefon.
 *
 * Die Termine liegen im Jahr 2099 (alle Dienstage), die vergangenen relativ zu heute.
 */

/** Das Datum vor `n` Tagen (Ortszeit des Browsers, wie der Client rechnet). */
function vorTagen(n: number): string {
  const t = new Date(Date.now() - n * 86_400_000)
  const zwei = (z: number) => String(z).padStart(2, '0')
  return `${String(t.getFullYear())}-${zwei(t.getMonth() + 1)}-${zwei(t.getDate())}`
}

/** Breite, um die die Seite ueber das Fenster hinausragt (0 = kein seitliches Scrollen). */
async function ueberhangHorizontal(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/** Meldet den Admin an: Termin 1 mit Zusagen, 2 ohne, 3 vergangen und abgeschlossen, 4 vergangen und abgesagt. */
async function start(page: Page, pfad = '/admin/termine') {
  const admin = await adminNachbilden(page)
  const termine = await termineNachbilden(page, [
    terminModell({ terminId: 1, datum: '2099-01-13', uhrzeit: '19:00:00' }),
    terminModell({ terminId: 2, datum: '2099-01-20', uhrzeit: '19:00:00', zusagen: [] }),
    terminModell({ terminId: 3, datum: vorTagen(7), status: 'ABGESCHLOSSEN' }),
    terminModell({ terminId: 4, datum: vorTagen(14), status: 'ABGESAGT', zusagen: [] }),
  ])
  const verwaltung = await terminverwaltungNachbilden(page, termine)
  await page.goto(pfad)
  return { admin, termine, verwaltung }
}

test.describe('Terminliste', () => {
  test('zeigt kommende und vergangene Termine getrennt, jeden genau einmal, mit Link zur Verwaltung', async ({ page }) => {
    await start(page)

    await expect(page.getByRole('heading', { level: 1, name: 'Termine' })).toBeVisible()
    await expect(page.getByTestId('admin-termine-kommende-liste').getByRole('listitem')).toHaveCount(2)
    await expect(page.getByTestId('admin-termine-vergangene-liste').getByRole('listitem')).toHaveCount(2)
    await expect(page.getByTestId('admin-termin-zeile-3')).toContainText('Abgeschlossen')
    await expect(page.getByTestId('admin-termin-zeile-4')).toContainText('Abgesagt')
    expect(await ueberhangHorizontal(page)).toBe(0)

    await page.getByTestId('admin-termin-bearbeiten-2').click()
    await expect(page).toHaveURL(/\/admin\/termine\/2$/)
    await expect(page.getByTestId('admin-termin-verwaltung')).toBeVisible()
  })

  test('jede Karte nennt Art und Aktionen; „Bearbeiten“ und „Entfernen“ sind gleich breit und mindestens 44 px hoch', async ({ page }) => {
    await start(page)

    await expect(page.getByTestId('admin-termin-einzel-1')).toHaveText('Einzeltermin')
    await expect(page.getByTestId('admin-termin-entfernen-3')).toHaveCount(0)
    const bearbeiten = await page.getByTestId('admin-termin-bearbeiten-2').boundingBox()
    const entfernen = await page.getByTestId('admin-termin-entfernen-2').boundingBox()
    expect(bearbeiten).not.toBeNull()
    expect(entfernen).not.toBeNull()
    expect(Math.abs((bearbeiten?.width ?? 0) - (entfernen?.width ?? 1))).toBeLessThanOrEqual(1)
    expect(bearbeiten?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(entfernen?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('entfernt einen Termin direkt aus der Liste: Bestaetigung, dann Hinweis, Karte weg, Fokus auf der Ueberschrift', async ({ page }) => {
    const { verwaltung } = await start(page)

    await page.getByTestId('admin-termin-entfernen-2').click()
    await expect(page.getByTestId('admin-termine-entfernen-dialog')).toContainText('nicht rückgängig')
    expect(verwaltung.koerper.entfernt).toHaveLength(0)
    await page.getByTestId('admin-termine-entfernen-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-termine-entfernt')).toContainText('Termin entfernt.')
    await expect(page.getByTestId('admin-termin-zeile-2')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1, name: 'Termine' })).toBeFocused()
    expect(verwaltung.koerper.entfernt).toEqual([{ terminId: 2 }])
  })

  test('ein Termin mit Rueckmeldungen laesst sich in der Liste nicht entfernen und verweist auf die Verwaltung', async ({ page }) => {
    await start(page)

    await page.getByTestId('admin-termin-entfernen-1').click()
    await page.getByTestId('admin-termine-entfernen-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-termine-in-verwendung')).toContainText('lässt sich nicht entfernen')
    await expect(page.getByTestId('admin-termin-zeile-1')).toBeVisible()
    await page.getByTestId('admin-termine-in-verwendung-link').click()
    await expect(page).toHaveURL(/\/admin\/termine\/1$/)
  })
})

test.describe('Termin anlegen', () => {
  test('legt einen Einzeltermin an: nur ausgefuellte Felder im Koerper, danach die Verwaltung mit Hinweis', async ({ page }) => {
    const { verwaltung } = await start(page)

    await page.getByTestId('admin-termin-anlegen').click()
    await expect(page).toHaveURL(/\/admin\/termine\/neu$/)
    await page.getByTestId('termin-datum').fill('2099-02-03')
    await page.getByTestId('termin-uhrzeit').fill('20:30')
    await page.getByTestId('admin-termin-neu-absenden').click()

    await expect(page).toHaveURL(/\/admin\/termine\/101$/)
    await expect(page.getByTestId('admin-termin-hinweis')).toContainText('Termin angelegt.')
    expect(verwaltung.koerper.angelegt).toEqual([{ datum: '2099-02-03', uhrzeit: '20:30' }])
  })

  test('„Abbrechen“ fuehrt ohne Senden zur Liste zurueck', async ({ page }) => {
    const { verwaltung } = await start(page, '/admin/termine/neu')

    await page.getByTestId('termin-datum').fill('2099-02-03')
    await page.getByTestId('admin-termin-neu-abbrechen').click()

    await expect(page).toHaveURL(/\/admin\/termine$/)
    expect(verwaltung.koerper.angelegt).toHaveLength(0)
  })

  test('Datum und Uhrzeit stehen nebeneinander, die Art-Auswahl ist ein Umschalter mit „Einzeltermin“ vorn', async ({ page }) => {
    await start(page, '/admin/termine/neu')

    await expect(page.getByRole('heading', { level: 1, name: 'Neuer Termin' })).toBeVisible()
    await expect(page.getByTestId('admin-art-einzel')).toBeChecked()
    const datum = await page.getByTestId('termin-datum').boundingBox()
    const uhrzeit = await page.getByTestId('termin-uhrzeit').boundingBox()
    expect(Math.abs((datum?.y ?? 0) - (uhrzeit?.y ?? 99))).toBeLessThanOrEqual(2)
    expect((uhrzeit?.x ?? 0)).toBeGreaterThan((datum?.x ?? 0) + (datum?.width ?? 0) - 1)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('Serie auf dem Telefon: sieben Wochentage mit mindestens 44 px Hoehe, Start und Ende sowie Uhrzeit und Ort nebeneinander', async ({ page }) => {
    await start(page, '/admin/termine/neu')

    await page.getByTestId('admin-art-serie').check()
    await expect(page.getByTestId('serie-wochentag')).toBeVisible()
    for (let tag = 1; tag <= 7; tag++) {
      const kasten = await page.getByTestId(`serie-wochentag-${String(tag)}`).boundingBox()
      expect(kasten?.height ?? 0, `Wochentag ${String(tag)}`).toBeGreaterThanOrEqual(44)
    }
    const start1 = await page.getByTestId('serie-startdatum').boundingBox()
    const ende = await page.getByTestId('serie-enddatum').boundingBox()
    expect(Math.abs((start1?.y ?? 0) - (ende?.y ?? 99))).toBeLessThanOrEqual(2)
    const uhrzeit = await page.getByTestId('serie-uhrzeit').boundingBox()
    const ort = await page.getByTestId('serie-ort').boundingBox()
    expect(Math.abs((uhrzeit?.y ?? 0) - (ort?.y ?? 99))).toBeLessThanOrEqual(2)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('ein belegter Zeitpunkt steht am Uhrzeitfeld, die Eingaben bleiben', async ({ page }) => {
    await start(page, '/admin/termine/neu')

    await page.getByTestId('termin-datum').fill('2099-01-13')
    await page.getByTestId('termin-uhrzeit').fill('19:00')
    await page.getByTestId('admin-termin-neu-absenden').click()

    await expect(page.getByTestId('termin-uhrzeit-fehler')).toContainText('Zu diesem Zeitpunkt gibt es bereits einen Termin')
    await expect(page.getByTestId('termin-uhrzeit')).toBeFocused()
    await expect(page.getByTestId('termin-datum')).toHaveValue('2099-01-13')
    await expect(page).toHaveURL(/\/admin\/termine\/neu$/)
  })

  test('ein Zeitpunkt in der Vergangenheit wird abgewiesen, ohne etwas zu senden', async ({ page }) => {
    const { verwaltung } = await start(page, '/admin/termine/neu')

    await page.getByTestId('termin-datum').fill(vorTagen(0))
    await page.getByTestId('termin-uhrzeit').fill('00:00')
    await page.getByTestId('admin-termin-neu-absenden').click()

    await expect(page.getByTestId('termin-uhrzeit-fehler')).toContainText('Vergangenheit')
    expect(verwaltung.koerper.angelegt).toHaveLength(0)
  })

  test('legt eine Serie an: Bestaetigung nennt die Folgen, Ergebnis zeigt angelegte und uebersprungene Zeitpunkte', async ({ page }) => {
    const { verwaltung } = await start(page, '/admin/termine/neu')

    await page.getByTestId('admin-art-serie').check()
    await page.getByTestId('serie-titel').fill('Montagskicker Winter')
    await page.getByTestId('serie-wochentag-2').check()
    await page.getByTestId('serie-uhrzeit').fill('19:00')
    await page.getByTestId('serie-startdatum').fill('2099-01-06')
    await page.getByTestId('serie-enddatum').fill('2099-02-03')
    await page.getByTestId('admin-termin-neu-absenden').click()

    await expect(page.getByTestId('admin-serie-dialog')).toContainText('höchstens 52')
    await page.getByTestId('admin-serie-dialog-bestaetigen').click()

    await expect(page.getByTestId('serie-ergebnis')).toBeVisible()
    await expect(page.getByTestId('serie-angelegt-anzahl')).toContainText('3 Termine')
    // Die Zeitpunkte der Termine 1 und 2 sind belegt und werden uebersprungen.
    await expect(page.getByTestId('serie-uebersprungen-2099-01-13')).toBeVisible()
    await expect(page.getByTestId('serie-uebersprungen-2099-01-20')).toBeVisible()
    await expect(page.getByTestId('serie-ergebnis-titel')).toBeFocused()
    expect(verwaltung.koerper.serien).toEqual([
      {
        titel: 'Montagskicker Winter',
        wochentag: 2,
        uhrzeit: '19:00',
        startdatum: '2099-01-06',
        enddatum: '2099-02-03',
      },
    ])
    await page.getByTestId('serie-zu-den-terminen').click()
    await expect(page).toHaveURL(/\/admin\/termine$/)
    await expect(page.getByTestId('admin-termine-kommende-liste').getByRole('listitem')).toHaveCount(5)
  })
})

test.describe('Termin verwalten', () => {
  test('aendert nur das Geaenderte samt version, meldet „Gespeichert.“ und haelt den Fokus am Knopf', async ({ page }) => {
    const { verwaltung } = await start(page, '/admin/termine/2')

    await expect(page.getByTestId('admin-termin-speichern')).toHaveAttribute('aria-disabled', 'true')
    await page.getByTestId('termin-ort').fill('Neue Halle')
    await page.getByTestId('admin-termin-speichern').click()

    await expect(page.getByTestId('admin-termin-gespeichert')).toBeVisible()
    await expect(page.getByTestId('admin-termin-speichern')).toBeFocused()
    expect(verwaltung.koerper.geaendert).toEqual([{ terminId: 2, version: 1, ort: 'Neue Halle' }])
    await expect(page.getByTestId('termin-karte-ort')).toContainText('Neue Halle')
  })

  test('E5: bei einer fremden Aenderung setzt das Formular zurueck, sagt es und sendet nichts erneut', async ({ page }) => {
    const { verwaltung } = await start(page, '/admin/termine/2')
    await expect(page.getByTestId('termin-ort')).toHaveValue('Beispielhalle')

    // Eine zweite Person aendert den Ort, waehrend dieses Formular offen ist.
    verwaltung.fremdeAenderung(2, { ort: 'Fremde Halle' })
    await page.getByTestId('termin-datum').fill('2099-03-03')
    await page.getByTestId('admin-termin-speichern').click()

    await expect(page.getByTestId('admin-termin-veraltet')).toContainText('zwischenzeitlich geändert')
    await expect(page.getByTestId('termin-ort')).toHaveValue('Fremde Halle')
    await expect(page.getByTestId('termin-datum')).toHaveValue('2099-01-20')
    expect(verwaltung.koerper.geaendert).toHaveLength(1)

    // Erneut aendern gelingt mit der frischen version.
    await page.getByTestId('termin-datum').fill('2099-03-03')
    await page.getByTestId('admin-termin-speichern').click()
    await expect(page.getByTestId('admin-termin-gespeichert')).toBeVisible()
    expect(verwaltung.koerper.geaendert[1]).toEqual({ terminId: 2, version: 2, datum: '2099-03-03' })
  })

  test('sagt einen Termin ab: Dialog mit Folgen, danach „abgesagt“, nur „Termin entfernen“ bleibt, Fokus auf der Ueberschrift', async ({ page }) => {
    const { verwaltung } = await start(page, '/admin/termine/2')

    await page.getByTestId('admin-termin-absagen').click()
    await expect(page.getByTestId('admin-absagen-dialog')).toContainText('Die Absage ist endgültig.')
    await page.getByTestId('admin-absagen-dialog-bestaetigen').click()

    await expect(page.getByTestId('termin-abgesagt')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
    await expect(page.getByTestId('admin-termin-entfernen')).toBeVisible()
    await expect(page.getByTestId('admin-termin-absagen')).toHaveCount(0)
    await expect(page.getByTestId('admin-termin-aendern')).toHaveCount(0)
    expect(verwaltung.koerper.abgesagt).toEqual([{ terminId: 2 }])
  })

  test('kein „Termin abschliessen“ (der Server schliesst selbst ab); Absagen und Entfernen rot umrandet, nicht gefuellt', async ({ page }) => {
    await start(page, '/admin/termine/2')

    await expect(page.getByTestId('admin-termin-absagen')).toBeVisible()
    await expect(page.getByTestId('admin-termin-abschliessen')).toHaveCount(0)
    // `gefahrUmriss`: weisser Grund, roter Rand (--farbe-fehler #a6231c); gefuellt rot ist erst die Bestaetigung.
    const rot = 'rgb(166, 35, 28)'
    for (const id of ['admin-termin-absagen', 'admin-termin-entfernen']) {
      await expect(page.getByTestId(id)).toHaveCSS('background-color', 'rgb(255, 255, 255)')
      await expect(page.getByTestId(id)).toHaveCSS('border-top-color', rot)
    }
    await page.getByTestId('admin-termin-absagen').click()
    await expect(page.getByTestId('admin-absagen-dialog-bestaetigen')).toHaveCSS('background-color', rot)
  })

  test('entfernt einen Termin ohne Rueckmeldungen und kehrt mit Hinweis zur Liste zurueck', async ({ page }) => {
    const { verwaltung } = await start(page, '/admin/termine/2')

    await page.getByTestId('admin-termin-entfernen').click()
    await page.getByTestId('admin-entfernen-dialog-bestaetigen').click()

    await expect(page).toHaveURL(/\/admin\/termine$/)
    await expect(page.getByTestId('admin-termine-hinweis')).toContainText('Termin entfernt.')
    await expect(page.getByTestId('admin-termin-zeile-2')).toHaveCount(0)
    expect(verwaltung.koerper.entfernt).toEqual([{ terminId: 2 }])
  })

  test('ein Termin mit Rueckmeldungen laesst sich nicht entfernen; „Stattdessen absagen“ fuehrt zum richtigen Weg', async ({ page }) => {
    await start(page, '/admin/termine/1')

    await page.getByTestId('admin-termin-entfernen').click()
    await page.getByTestId('admin-entfernen-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-termin-in-verwendung')).toContainText('lässt sich nicht entfernen')
    await expect(page).toHaveURL(/\/admin\/termine\/1$/)
    await page.getByTestId('admin-termin-stattdessen-absagen').click()
    await expect(page.getByTestId('admin-absagen-dialog')).toBeVisible()
  })

  test('ein ungueltiger Pfad zeigt „nicht gefunden“, ohne die Verwaltung', async ({ page }) => {
    await start(page, '/admin/termine/abc')

    await expect(page.getByTestId('nicht-gefunden')).toBeVisible()
    await expect(page.getByTestId('admin-termin-verwaltung')).toHaveCount(0)
  })

  test('auf dem Telefon: kein seitliches Scrollen, Bedienelemente mindestens 44 px hoch', async ({ page }) => {
    await start(page, '/admin/termine/2')
    await expect(page.getByTestId('admin-termin-verwaltung')).toBeVisible()

    expect(await ueberhangHorizontal(page)).toBe(0)
    // Aufgabe Terminverwaltung: Absagen und Entfernen stehen untereinander gleich breit.
    const breiten = await Promise.all(
      ['admin-termin-absagen', 'admin-termin-entfernen'].map(async (id) => (await page.getByTestId(id).boundingBox())?.width ?? 0),
    )
    expect(Math.max(...breiten) - Math.min(...breiten)).toBeLessThanOrEqual(1)
    for (const id of ['termin-datum', 'termin-uhrzeit', 'termin-ort', 'admin-termin-speichern', 'admin-termin-absagen', 'admin-termin-entfernen']) {
      const kasten = await page.getByTestId(id).boundingBox()
      expect(kasten, id).not.toBeNull()
      expect(kasten?.height ?? 0, id).toBeGreaterThanOrEqual(44)
    }
  })
})
