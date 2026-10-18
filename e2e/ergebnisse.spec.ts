import { expect, test } from '@playwright/test'
import { ergebnisseNachbilden } from './hilfen/ergebnisse.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import {
  EIGENER_NAME,
  einteilungAus,
  terminModell,
  termineNachbilden,
  type TerminModell,
  type Zusage,
} from './hilfen/termine.js'

/**
 * Prueft den Tab „Ergebnisse“ und das Ergebnis eines Termins (C5, Stufe 3) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung, Termine, Ergebnis und Bilanz sind nachgebildet. Der Hub liest die
 * letzten Tage, deshalb liegen die abgeschlossenen Termine relativ zu heute.
 */

/** Das Datum vor `n` Tagen (Ortszeit des Browsers, wie der Client rechnet). */
function vorTagen(n: number): string {
  const t = new Date(Date.now() - n * 86_400_000)
  const zwei = (z: number) => String(z).padStart(2, '0')
  return `${String(t.getFullYear())}-${zwei(t.getMonth() + 1)}-${zwei(t.getDate())}`
}

/** Acht Zusagen, deren erste die eigene ist: Sie landet in Team A. */
const zusagenMitEigener: Zusage[] = [
  { name: EIGENER_NAME, gast: false },
  ...Array.from({ length: 7 }, (_, i) => ({ name: `Beispielspieler ${String(i + 11)}`, gast: false })),
]

/** Ein abgeschlossener Termin mit Einteilung (die eigene Person ist in Team A). */
function abgeschlossen(teil: Partial<TerminModell> & { terminId: number }, mitTeams = true): TerminModell {
  const modell = terminModell({
    status: 'ABGESCHLOSSEN',
    datum: vorTagen(2),
    zusagen: zusagenMitEigener,
    eigene: true,
    ...teil,
  })
  if (mitTeams && !modell.teams) {
    modell.teams = einteilungAus(modell)
    modell.teamsVersion = modell.teilnehmerVersion
  }
  return modell
}

test.describe('Tab Ergebnisse', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('zeigt ohne abgeschlossenen Termin den Leerzustand und die Bilanz', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 1 })])
    await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')

    await expect(page.getByTestId('ergebnisse-leer')).toContainText('Noch kein abgeschlossener Termin')
    await expect(page.getByTestId('bilanz-karte')).toBeVisible()
    await expect(page.getByTestId('tab-ergebnisse')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
  })

  test('traegt das Ergebnis ein: Formular, Bestaetigung, Anzeige, Fokus und Bilanz', async ({ page }) => {
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 })])
    const ergebnisse = await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')

    await expect(page.getByTestId('bilanz-leer')).toContainText('Noch keine Spiele gewertet.')
    await expect(page.getByTestId('ergebnis-absenden')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('ergebnis-grund')).toContainText('Bitte wähle den Ausgang.')

    await page.getByTestId('ergebnis-sieger-a').check()
    await page.getByTestId('ergebnis-deutlich').check()
    await page.getByTestId('ergebnis-absenden').click()

    await expect(page.getByTestId('ergebnis-dialog')).toBeVisible()
    await expect(page.getByTestId('ergebnis-zusammenfassung')).toHaveText('Team A hat deutlich gewonnen.')
    expect(ergebnisse.erfassungen).toHaveLength(0)
    await page.getByTestId('ergebnis-bestaetigen').click()

    await expect(page.getByTestId('ergebnis-anzeige-satz')).toHaveText('Team A hat deutlich gewonnen.')
    await expect(page.getByTestId('ergebnis-anzeige-titel')).toBeFocused()
    await expect(page.getByTestId('ergebnis-erfasst')).toContainText('Das Ergebnis wurde eingetragen.')
    await expect(page.getByTestId('ergebnis-formular')).toHaveCount(0)
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
    // Die eigene Person stand in Team A: ein Sieg mehr, die Bilanz wurde neu gelesen.
    await expect(page.getByTestId('bilanz-siege')).toHaveText('1')
    expect(ergebnisse.erfassungen).toEqual([{ terminId: 102, sieger: 'A', deutlich: true, kopf: undefined }])
    expect(ergebnisse.bilanzabrufe.every((k) => k === 'true')).toBe(true)
  })

  test('sperrt bei Unentschieden den Haken und sendet deutlich = false', async ({ page }) => {
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 })])
    const ergebnisse = await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')

    await page.getByTestId('ergebnis-sieger-b').check()
    await page.getByTestId('ergebnis-deutlich').check()
    await page.getByTestId('ergebnis-sieger-u').check()
    await expect(page.getByTestId('ergebnis-deutlich')).toBeDisabled()
    await expect(page.getByTestId('ergebnis-deutlich')).not.toBeChecked()
    await expect(page.getByTestId('ergebnis-deutlich-grund')).toContainText('Nur bei einem Sieg möglich.')

    await page.getByTestId('ergebnis-absenden').click()
    await expect(page.getByTestId('ergebnis-zusammenfassung')).toHaveText('Unentschieden.')
    await page.getByTestId('ergebnis-bestaetigen').click()

    await expect(page.getByTestId('ergebnis-anzeige-satz')).toHaveText('Unentschieden.')
    await expect(page.getByTestId('bilanz-unentschieden')).toHaveText('1')
    expect(ergebnisse.erfassungen[0]).toMatchObject({ sieger: 'U', deutlich: false })
  })

  test('schliesst die Bestaetigung mit „Zurueck“ ohne Eintrag', async ({ page }) => {
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 })])
    const ergebnisse = await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')

    await page.getByTestId('ergebnis-sieger-b').check()
    await page.getByTestId('ergebnis-absenden').click()
    await page.getByTestId('ergebnis-zurueck').click()

    await expect(page.getByTestId('ergebnis-dialog')).toBeHidden()
    await expect(page.getByTestId('ergebnis-sieger-b')).toBeChecked()
    expect(ergebnisse.erfassungen).toHaveLength(0)
  })

  test('zeigt bei einem schnelleren Eintrag den Hinweis und dessen Ergebnis, ohne Fehler', async ({ page }) => {
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 })])
    const ergebnisse = await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')
    await page.getByTestId('ergebnis-sieger-b').check()

    // Jemand war schneller: Der Server hat das Ergebnis, die Seite kennt es noch nicht.
    welt.modelle[0].ergebnis = {
      sieger: 'U',
      deutlich: false,
      erfasstVon: 'Beispielspieler 07',
      erfasstAm: new Date().toISOString(),
      korrigiertAm: null,
      version: 1,
    }
    await page.getByTestId('ergebnis-absenden').click()
    await page.getByTestId('ergebnis-bestaetigen').click()

    await expect(page.getByTestId('ergebnis-vorhanden')).toContainText(
      'Das Ergebnis war bereits erfasst; es gilt der erste Eintrag.',
    )
    await expect(page.getByTestId('ergebnis-anzeige-satz')).toHaveText('Unentschieden.')
    await expect(page.getByTestId('ergebnis-anzeige-erfasst')).toContainText('Beispielspieler 07')
    await expect(page.getByTestId('ergebnis-anzeige-titel')).toBeFocused()
    await expect(page.getByTestId('ergebnis-fehler')).toHaveCount(0)
    await expect(page.getByTestId('ergebnis-dialog')).toBeHidden()
    expect(ergebnisse.erfassungen).toHaveLength(1)
  })

  test('zeigt ein vorhandenes Ergebnis ohne Formular und ohne Bearbeitung', async ({ page }) => {
    const welt = await termineNachbilden(page, [
      abgeschlossen({
        terminId: 102,
        ergebnis: {
          sieger: 'B',
          deutlich: false,
          erfasstVon: 'Beispielspieler 07',
          erfasstAm: new Date().toISOString(),
          korrigiertAm: new Date().toISOString(),
          version: 2,
        },
      }),
    ])
    await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')

    await expect(page.getByTestId('ergebnis-anzeige-satz')).toHaveText('Team B hat gewonnen.')
    await expect(page.getByTestId('ergebnis-anzeige-korrigiert')).toBeVisible()
    await expect(page.getByTestId('ergebnis-formular')).toHaveCount(0)
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()
  })

  test('sagt bei einem abgeschlossenen Termin ohne Einteilung, warum nichts einzutragen ist', async ({ page }) => {
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 }, false)])
    await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')

    await expect(page.getByTestId('ergebnis-ohne-einteilung')).toContainText(
      'Für diesen Termin wurden keine Teams eingeteilt, ein Ergebnis lässt sich daher nicht eintragen.',
    )
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
  })
})

test.describe('Gast', () => {
  test('sieht keine Bilanz und ruft sie nicht ab', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900, rolle: 'GAST' })
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 })])
    const ergebnisse = await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')

    await expect(page.getByTestId('ergebnis-formular')).toBeVisible()
    await expect(page.getByTestId('bilanz-karte')).toHaveCount(0)
    expect(ergebnisse.bilanzabrufe).toHaveLength(0)
  })
})

test.describe('Ergebnis eines Termins', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('erreicht das Ergebnis ueber den Verweis der Termin-Ansicht und ohne Tab-Leiste', async ({ page }) => {
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 })])
    await ergebnisseNachbilden(page, welt)
    await page.goto('/termine/102')
    await page.getByTestId('termin-ergebnis-link').click()

    await expect(page).toHaveURL(/\/ergebnisse\/102$/)
    await expect(page.getByTestId('ergebnis-formular')).toBeVisible()
    await expect(page.getByTestId('tab-leiste')).toHaveCount(0)
  })

  test('zeigt bei einer ungueltigen Adresse „nicht gefunden“ ohne Abruf', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/ergebnisse/abc')
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    expect(welt.detailabrufe).toHaveLength(0)
  })

  test('sagt bei einem geplanten Termin, wann das Ergebnis geht', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse/102')
    await expect(page.getByTestId('ergebnis-noch-nicht')).toContainText('sobald der Termin abgeschlossen ist')
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
  })
})

test.describe('Layout bei 360 x 780', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('haelt Formular und Aktion im Sichtfeld, scrollt nicht waagerecht und erfuellt die Tap-Ziele', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    const welt = await termineNachbilden(page, [abgeschlossen({ terminId: 102 })])
    await ergebnisseNachbilden(page, welt)
    await page.goto('/ergebnisse')
    await expect(page.getByTestId('ergebnis-formular')).toBeVisible()

    const leiste = await page.getByTestId('aktionsleiste').boundingBox()
    expect(leiste!.y + leiste!.height).toBeLessThanOrEqual(780 + 0.5)
    const breiten = await page.evaluate(() => ({
      inhalt: document.documentElement.scrollWidth,
      sicht: document.documentElement.clientWidth,
    }))
    expect(breiten.inhalt).toBeLessThanOrEqual(breiten.sicht)
    const aktion = await page.getByTestId('ergebnis-absenden').boundingBox()
    expect(aktion!.height).toBeGreaterThanOrEqual(63.5)
    // Die ganze Zeile einer Option ist das Tap-Ziel (A2).
    for (const id of ['ergebnis-sieger-a', 'ergebnis-sieger-b', 'ergebnis-sieger-u', 'ergebnis-deutlich']) {
      const zeile = await page.getByTestId(id).locator('xpath=ancestor::label').boundingBox()
      expect(zeile!.height).toBeGreaterThanOrEqual(43.5)
    }

    await page.getByTestId('ergebnis-sieger-a').check()
    await page.getByTestId('ergebnis-absenden').click()
    const dialog = await page.getByTestId('ergebnis-dialog').boundingBox()
    expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(780 + 0.5)
    await expect(page.getByTestId('ergebnis-bestaetigen')).toBeInViewport()
  })
})
