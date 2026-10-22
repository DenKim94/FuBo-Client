import { expect, test } from '@playwright/test'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { adminNachbilden } from './hilfen/admin.js'
import { teamsNachbilden } from './hilfen/teams.js'
import { EIGENER_NAME, inMinuten, terminModell, termineNachbilden, type Zusage } from './hilfen/termine.js'

/**
 * Prueft den Tab „Teams“ und die Teams eines Termins (C5, Stufe 2) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung, Termine und Teamgenerierung sind nachgebildet. Die Termine liegen
 * im Jahr 2099 und beginnen nie; wo der Beginn zaehlt, steht er wenige Minuten vor der
 * Uhr des Browsers, und `page.clock` rueckt die Zeit vor.
 */

/** `anzahl` Zusagen, deren erste die eigene ist, wenn `mitEigener` gesetzt ist. */
function zusagen(anzahl: number, mitEigener = false): Zusage[] {
  return Array.from({ length: anzahl }, (_, i) =>
    mitEigener && i === 0 ? { name: EIGENER_NAME, gast: false } : { name: `Beispielspieler ${String(i + 11)}`, gast: false },
  )
}

test.describe('Tab Teams', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('zeigt ohne Termin den Leerzustand', async ({ page }) => {
    await termineNachbilden(page, [])
    await page.goto('/teams')
    await expect(page.getByTestId('teams-leer')).toContainText('Kein Termin geplant')
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
    await expect(page.getByTestId('tab-teams')).toHaveAttribute('aria-current', 'page')
  })

  test('zeigt „Noch keine Einteilung“, generiert und setzt den Fokus auf die Einteilung', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(9, true), eigene: true })])
    await teamsNachbilden(page, welt)
    await page.goto('/teams')

    await expect(page.getByTestId('teams-nicht-generiert')).toContainText('Noch keine Einteilung')
    await page.getByTestId('teams-generieren').click()

    await expect(page.getByTestId('teams-anzeige')).toBeVisible()
    await expect(page.getByTestId('teams-nicht-generiert')).toHaveCount(0)
    await expect(page.getByTestId('teams-erfolg')).toContainText('Teams wurden generiert.')
    await expect(page.getByTestId('teams-anzeige-kopf')).toBeFocused()
    // Neun Spieler: ein Auswechselspieler, Team A zaehlt ihn mit.
    await expect(page.getByTestId('teams-anzeige-auswechselspieler')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: 'Team A (5)' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Team B (4)' })).toBeVisible()
    await expect(page.getByTestId('teams-anzeige')).toContainText(`${EIGENER_NAME} (du)`)
    expect(welt.generierungen).toEqual([{ terminId: 102, kopf: undefined }])
  })

  test('markiert die Einteilung nach einer fremden Absage als veraltet und zeigt sie weiter', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(8, true), eigene: true })])
    await teamsNachbilden(page, welt)
    await page.clock.install()
    await page.goto('/teams')
    await page.getByTestId('teams-generieren').click()
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()
    await expect(page.getByTestId('teams-anzeige-veraltet')).toHaveCount(0)

    // Jemand sagt ab: neue Teilnehmerversion, die Einteilung stammt aus der alten.
    welt.modelle[0].zusagen.pop()
    welt.modelle[0].teilnehmerVersion += 1
    await page.clock.runFor(21_000)

    await expect(page.getByTestId('teams-anzeige-veraltet')).toContainText(
      'Seit dieser Einteilung hat sich die Teilnehmerliste geändert.',
    )
    // Verstecken waere falsch.
    await expect(page.getByTestId('teams-anzeige-a')).toBeVisible()
    await expect(page.getByTestId('teams-generieren')).toHaveText('Teams neu generieren')
    expect(welt.detailabrufe.every((k) => k === 'true')).toBe(true)
  })

  test('fragt vor dem Ersetzen einer aktuellen Einteilung nach', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(8, true), eigene: true })])
    await teamsNachbilden(page, welt)
    await page.goto('/teams')
    await page.getByTestId('teams-generieren').click()
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()

    await page.getByTestId('teams-generieren').click()
    await expect(page.getByTestId('teams-ersetzen-dialog')).toBeVisible()
    await expect(page.getByTestId('teams-ersetzen-dialog')).toContainText('wird ersetzt')
    await page.getByTestId('teams-ersetzen-abbrechen').click()
    await expect(page.getByTestId('teams-ersetzen-dialog')).toBeHidden()
    expect(welt.generierungen).toHaveLength(1)

    await page.getByTestId('teams-generieren').click()
    await page.getByTestId('teams-ersetzen-bestaetigen').click()
    await expect.poll(() => welt.generierungen.length).toBe(2)
  })

  test('sperrt nach erschoepftem Kontingent mit Grund, bis jemand neu zusagt', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(8, true), eigene: true, kontingent: 1 })])
    await teamsNachbilden(page, welt)
    await page.clock.install()
    await page.goto('/teams')
    await page.getByTestId('teams-generieren').click()
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()

    // Gleiche Teilnehmerversion, Kontingent 1: Der zweite Lauf scheitert, der Server nennt keine Zahl.
    await page.getByTestId('teams-generieren').click()
    await page.getByTestId('teams-ersetzen-bestaetigen').click()

    await expect(page.getByTestId('teams-grund')).toHaveText('Das Kontingent für diese Teilnehmerliste ist aufgebraucht. Eine neue Zusage setzt es zurück.')
    await expect(page.getByTestId('teams-generieren')).toHaveAttribute('aria-disabled', 'true')
    // Keine Fehlermeldung: Das ist ein Zustand, kein Fehler.
    await expect(page.getByTestId('teams-fehler')).toHaveCount(0)

    // Ein Tipp auf die gesperrte Aktion verbraucht nichts und sendet nichts.
    // `force`: Playwright haelt `aria-disabled` fuer „nicht bedienbar“; ein Finger tippt trotzdem.
    const gesendet = welt.generierungen.length
    await page.getByTestId('teams-generieren').click({ force: true })
    expect(welt.generierungen.length).toBe(gesendet)

    // Jemand sagt neu zu: neue Version und (am Server) neuer Kontingentstand. Eine Absage oeffnete es nicht (22.10.2026).
    welt.modelle[0].zusagen.push({ name: 'Beispielspieler 40', gast: false })
    welt.modelle[0].teilnehmerVersion += 1
    await page.clock.runFor(21_000)
    await expect(page.getByTestId('teams-grund')).toHaveCount(0)
    await expect(page.getByTestId('teams-generieren')).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('sperrt ohne Mindestzahl mit Grund', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(4, true), eigene: true, min: 6 })])
    await teamsNachbilden(page, welt)
    await page.goto('/teams')

    await expect(page.getByTestId('teams-grund')).toContainText('Mindestens 6 Zusagen sind erforderlich.')
    await expect(page.getByTestId('teams-generieren')).toHaveAttribute('aria-disabled', 'true')
    // `force`: Playwright haelt `aria-disabled` fuer „nicht bedienbar“; ein Finger tippt trotzdem.
    await page.getByTestId('teams-generieren').click({ force: true })
    expect(welt.generierungen).toHaveLength(0)
  })

  test('nimmt bei Beginn die Aktion weg und zeigt die feststehende Einteilung', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    const beginn = inMinuten(3)
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(8, true), eigene: true, ...beginn })])
    await teamsNachbilden(page, welt)
    await page.clock.install()
    await page.goto('/teams')
    await page.getByTestId('teams-generieren').click()
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()

    await page.clock.fastForward(5 * 60_000)

    await expect(page.getByTestId('teams-fixiert')).toContainText('Die Einteilung steht fest.')
    await expect(page.getByTestId('teams-generieren')).toHaveCount(0)
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()
  })
})

test.describe('Nur Teilnehmer generieren', () => {
  const GRUND = 'Nur Teilnehmer des Termins dürfen den Team-Generator nutzen.'

  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('ohne eigene Zusage ist die Aktion gesperrt und sendet nichts', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(8) })])
    await teamsNachbilden(page, welt)
    await page.goto('/teams')

    await expect(page.getByTestId('teams-grund')).toHaveText(GRUND)
    await expect(page.getByTestId('teams-generieren')).toHaveAttribute('aria-disabled', 'true')
    await page.getByTestId('teams-generieren').click({ force: true })
    expect(welt.generierungen).toHaveLength(0)
  })

  test('auf der Warteschlange ist die Aktion ebenfalls gesperrt', async ({ page }) => {
    // Hoechstzahl 8, die eigene Zusage ist die neunte.
    const liste = [...zusagen(8), { name: EIGENER_NAME, gast: false }]
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: liste, eigene: true, max: 8 })])
    await teamsNachbilden(page, welt)
    await page.goto('/teams')

    await expect(page.getByTestId('teams-grund')).toHaveText(GRUND)
    await page.getByTestId('teams-generieren').click({ force: true })
    expect(welt.generierungen).toHaveLength(0)
  })
})

test.describe('Admin am Termin', () => {
  test('der Admin darf ohne Zusage generieren (wie am Server)', async ({ page }) => {
    await adminNachbilden(page)
    const welt = await termineNachbilden(page, [{ ...terminModell({ terminId: 102, zusagen: zusagen(8) }), adminSitzung: true }])
    await teamsNachbilden(page, welt)
    await page.goto('/teams/102')

    await expect(page.getByTestId('teams-generieren')).not.toHaveAttribute('aria-disabled', 'true')
    await page.getByTestId('teams-generieren').click()
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()
    expect(welt.generierungen).toHaveLength(1)
  })
})

test.describe('Teams eines Termins', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('erreicht die Teams ueber den Verweis der Termin-Ansicht und ohne Tab-Leiste', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(8) })])
    await teamsNachbilden(page, welt)
    await page.goto('/termine/102')
    await page.getByTestId('termin-teams-link').click()

    await expect(page).toHaveURL(/\/teams\/102$/)
    await expect(page.getByTestId('teams-nicht-generiert')).toBeVisible()
    await expect(page.getByTestId('tab-leiste')).toHaveCount(0)
  })

  test('zeigt bei einer ungueltigen Adresse „nicht gefunden“ ohne Abruf', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/teams/abc')
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    expect(welt.detailabrufe).toHaveLength(0)
  })
})

test.describe('Layout bei 360 x 780', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('haelt Aktion und Grund im Sichtfeld, scrollt nicht waagerecht und erfuellt die Tap-Ziele', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102, zusagen: zusagen(22, true), eigene: true, min: 6 })])
    await teamsNachbilden(page, welt)
    await page.goto('/teams')
    await page.getByTestId('teams-generieren').click()
    await expect(page.getByTestId('teams-anzeige')).toBeVisible()

    const leiste = await page.getByTestId('aktionsleiste').boundingBox()
    expect(leiste!.y + leiste!.height).toBeLessThanOrEqual(780 + 0.5)
    const breiten = await page.evaluate(() => ({
      inhalt: document.documentElement.scrollWidth,
      sicht: document.documentElement.clientWidth,
    }))
    expect(breiten.inhalt).toBeLessThanOrEqual(breiten.sicht)
    const aktion = await page.getByTestId('teams-generieren').boundingBox()
    expect(aktion!.height).toBeGreaterThanOrEqual(63.5)
  })
})
