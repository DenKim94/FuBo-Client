import { expect, test, type Page } from '@playwright/test'
import { adminStart as start, e2eProfil, ueberhangHorizontal } from './hilfen/admin.js'

/** Legt im Team-Generator einen Gast an und uebernimmt ihn (seit 24.10.2026 mit Bestaetigung). */
async function gastAnlegen(page: Page, name = '', stufe?: 'STARK' | 'MITTEL' | 'SCHWACH') {
  await page.getByTestId('admin-teams-gast-hinzufuegen').click()
  if (name !== '') await page.getByTestId('admin-teams-gast-name').fill(name)
  if (stufe) await page.getByTestId(`admin-teams-gast-stufe-${stufe}`).check()
  await page.getByTestId('admin-teams-gast-uebernehmen').click()
}

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

    await expect(page.getByRole('heading', { level: 1, name: 'Gäste' })).toBeVisible()
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

  test('„Plaetze freigeben“ gibt nur den verwaisten Platz frei, ohne Dialog, und laesst den lebenden unberuehrt', async ({ page }) => {
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

test.describe('Skill-Stufe eines Gastes (Gaeste-Verwaltung)', () => {
  test('aendert die Stufe: Vorauswahl aus der Teilnahme, Name unveraendert, Teilnehmerkreis zaehlt hoch, Zeile zeigt die neue Stufe', async ({ page }) => {
    const { welt, termine } = await start(page, '/admin/gaeste')

    await expect(page.getByTestId('admin-gaeste-termin-1')).toContainText('Beispielgast (Gast)')
    await expect(page.getByTestId('admin-gast-stufe-anzeige-1-8')).toHaveText('Aktuelle Stufe: Mittel')
    await page.getByTestId('admin-gast-stufe-1-8').click()
    // Die Teilnahme zaehlt (MITTEL ohne Angabe), nicht die Selbsteinschaetzung des Gastplatzes (STARK).
    await expect(page.getByTestId('admin-gast-stufe-wahl-MITTEL')).toBeChecked()
    await page.getByTestId('admin-gast-stufe-wahl-SCHWACH').check()
    await page.getByTestId('admin-gast-stufe-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-gast-stufe-dialog')).toBeHidden()
    expect(welt.koerper.gastStufen).toEqual([{ terminId: 1, gastName: 'Beispielgast', stufe: 'SCHWACH' }])
    expect(termine.modelle[0].teilnehmerVersion).toBe(2)
    await expect(page.getByTestId('admin-gast-stufe-anzeige-1-8')).toHaveText('Aktuelle Stufe: Schwach')
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('ein abgemeldeter Gast mit Zusage erscheint, obwohl kein Gastplatz belegt ist (Befund vom 24.10.2026)', async ({ page }) => {
    const { welt } = await start(page, '/admin/gaeste')
    for (const platz of welt.gastplaetze) Object.assign(platz, { belegt: false, belegtSeit: null, gastName: null, gastStufe: null, sitzungGueltig: null })
    await page.reload()

    await expect(page.getByTestId('admin-gaeste-zusammenfassung')).toHaveText('0 von 4 Plätzen belegt')
    await expect(page.getByTestId('admin-gaeste-termin-1')).toContainText('Beispielgast (Gast)')
    await expect(page.getByTestId('admin-gaeste-leer')).toHaveText('Zurzeit ist kein Gast angemeldet.')
    // Die Stufe kommt aus der Teilnahme (nur fuer den Admin) und bleibt nach dem Abmelden sichtbar.
    await expect(page.getByTestId('admin-gast-stufe-anzeige-1-8')).toHaveText('Aktuelle Stufe: Mittel')
  })

  test('entfernt einen Gast aus dem Termin (Absage fuer den Gast): Dialog, Koerper, Zeile weg, Hinweis, Fokus', async ({ page }) => {
    const { welt, termine } = await start(page, '/admin/gaeste')

    const entfernen = page.getByTestId('admin-gast-entfernen-1-8')
    expect((await entfernen.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44)
    await entfernen.click()
    await expect(page.getByTestId('admin-gast-entfernen-dialog')).toContainText('aus dem Termin entfernt.')
    await page.getByTestId('admin-gast-entfernen-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-gaeste-termin-1')).toHaveCount(0)
    await expect(page.getByTestId('admin-gaeste-termine-hinweis')).toContainText('Beispielgast (Gast) ist am')
    await expect(page.getByRole('heading', { level: 2, name: 'Gäste in Terminen' })).toBeFocused()
    expect(welt.koerper.gastAbgesagt).toEqual([{ terminId: 1, gastName: 'Beispielgast' }])
    expect(termine.modelle[0].teilnehmerVersion).toBe(2)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('die Terminverwaltung bietet die Stufe nicht mehr an', async ({ page }) => {
    await start(page, '/admin/termine/1')

    await expect(page.getByRole('heading', { level: 2, name: 'Weitere Aktionen' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Gäste' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Stufe ändern/ })).toHaveCount(0)
  })
})

/** Eine Karte mit Luecken, wie nach einem Datenimport (E7). */
const UNVOLLSTAENDIG = e2eProfil({ spielerId: 4, name: 'Beispielspieler 04', skills: { ANGRIFF: 4, VERTEIDIGUNG: 2, SPIELSTAERKE: 3 } })

test.describe('Manuelle Teamgenerierung', () => {
  test('Teamstaerken (05.11.2026): eingeklappt zwischen Hinweis und Team A; Tabelle mit Summen ohne Springer, ohne seitlichen Ueberhang', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 } })
    // Team A = 01 und 03 (03 ist Springer), Team B = Gast 1 (Gaeste zaehlen in der Nachbildung 0).
    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await gastAnlegen(page)
    await page.getByTestId('admin-teams-berechnen').click()

    const schalter = page.getByRole('button', { name: 'Teamstärken anzeigen' })
    await expect(schalter).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByTestId('admin-teams-staerken-tabelle')).toBeHidden()
    // Lage: unter dem Hinweis des Ergebnisses, ueber Team A. In einem Zug gemessen, das Ergebnis rollt gerade sanft.
    const lage = await page.evaluate(() => {
      const rechteck = (id: string) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()
      const hinweis = rechteck('teams-manuell-hinweis-ergebnis')
      const knopf = rechteck('admin-teams-staerken-umschalter')
      const teamA = rechteck('admin-teams-ergebnis-teams-a')
      return { nachHinweis: knopf.top >= hinweis.bottom, vorTeamA: teamA.top >= knopf.bottom, hoehe: knopf.height }
    })
    expect(lage.nachHinweis).toBe(true)
    expect(lage.vorTeamA).toBe(true)
    expect(lage.hoehe).toBeGreaterThanOrEqual(44)

    await schalter.click()

    const tabelle = page.getByRole('table', { name: 'Gesamtpunkte je Team und Kategorie' })
    await expect(tabelle).toBeVisible()
    await expect(page.getByRole('button', { name: 'Teamstärken ausblenden' })).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByTestId('admin-teams-staerken-zeile-ANGRIFF')).toHaveText('Angriff30')
    await expect(page.getByTestId('admin-teams-staerken-zeile-TORWART')).toHaveText('Torwart20')
    await expect(page.getByTestId('admin-teams-staerken-springer')).toContainText('Der Springer (Beispielspieler 03) ist in den Gesamtpunkten nicht berücksichtigt')
    expect(await ueberhangHorizontal(page)).toBe(0)
    // Die Tabelle passt in ihre Spalte, und kein Kategoriename ragt aus seiner Zelle (vorher „Kateg-orie“ bzw. abgeschnitten).
    const masse = await tabelle.evaluate((t) => {
      const zeilen = (zelle: Element) => {
        const bereich = document.createRange()
        bereich.selectNodeContents(zelle)
        return bereich.getClientRects().length
      }
      return {
        breite: t.getBoundingClientRect().width,
        verfuegbar: t.parentElement!.clientWidth,
        ueberstand: [...t.querySelectorAll('th, td')].filter((c) => c.scrollWidth > c.clientWidth).map((c) => c.textContent),
        mehrzeilig: [...t.querySelectorAll('tbody th')].filter((c) => zeilen(c) > 1).map((c) => c.textContent),
      }
    })
    expect(masse.breite).toBeLessThanOrEqual(masse.verfuegbar)
    expect(masse.ueberstand).toEqual([])
    expect(masse.mehrzeilig).toEqual([])
    // Die Kopfflaeche ist selbst gerundet (Safari beschneidet eine <table> mit overflow: hidden nicht; 05.11.2026).
    const ecken = await tabelle.evaluate((t) => {
      const kopf = t.querySelectorAll('thead th')
      const radius = (e: Element, seite: 'borderTopLeftRadius' | 'borderTopRightRadius') => parseFloat(getComputedStyle(e)[seite])
      const karte = parseFloat(getComputedStyle(t).borderTopLeftRadius)
      return { links: radius(kopf[0], 'borderTopLeftRadius'), rechts: radius(kopf[kopf.length - 1], 'borderTopRightRadius'), karte }
    })
    expect(ecken.links).toBe(ecken.karte - 1)
    expect(ecken.rechts).toBe(ecken.karte - 1)
  })

  test('nach dem Einteilen steht das Ergebnis oben im Bild, die Teams sind sichtbar (05.11.2026)', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 22 } })
    await page.getByTestId('admin-teams-alle').click()
    for (let i = 0; i < 3; i++) await gastAnlegen(page)
    await page.getByTestId('admin-teams-berechnen').click()

    const ergebnis = page.getByTestId('admin-teams-ergebnis')
    await expect(ergebnis.getByRole('heading', { level: 2, name: 'Ergebnis' })).toBeFocused()
    // Vorher stand nur die Ueberschrift knapp ueber der Leiste (Fokus scrollt bis zum naechsten Rand). Oben steht der
    // Abschnitt, ausser die Seite ist vorher am Ende (grosses Fenster, wenig Inhalt darunter) – dann ganz unten.
    const lage = () =>
      page.evaluate(() => {
        const oben = document.querySelector('[data-testid="admin-teams-ergebnis"]')!.getBoundingClientRect().top
        const amEnde = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1
        return oben >= 0 && (oben <= 40 || amEnde)
      })
    await expect.poll(lage, { timeout: 3000 }).toBe(true)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await expect(page.getByTestId('admin-teams-ergebnis-teams-a')).toBeInViewport()
  })

  test('in der iOS-App rollt der eigene Scrollbereich zum Ergebnis, nicht die Seite (05.11.2026)', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 22 } })
    await page.evaluate(() => document.documentElement.setAttribute('data-ios-app', ''))
    await page.getByTestId('admin-teams-alle').click()
    for (let i = 0; i < 3; i++) await gastAnlegen(page)
    await page.getByTestId('admin-teams-berechnen').click()

    const ergebnis = page.getByTestId('admin-teams-ergebnis')
    await expect(ergebnis).toBeVisible()
    // Oben im Scrollbereich (nur Luft, kein Abstand fuer die Statusleiste) – ausser der Bereich ist am Ende.
    const lage = () =>
      page.evaluate(() => {
        const bereich = document.querySelector('[data-testid="layout-verlauf"]')!
        const abstand = document.querySelector('[data-testid="admin-teams-ergebnis"]')!.getBoundingClientRect().top - bereich.getBoundingClientRect().top
        const amEnde = Math.ceil(bereich.scrollTop + bereich.clientHeight) >= bereich.scrollHeight - 1
        return abstand >= 0 && (abstand <= 16 || amEnde)
      })
    await expect.poll(lage, { timeout: 3000 }).toBe(true)
    await expect(page.getByTestId('admin-teams-ergebnis-teams-a')).toBeInViewport()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    expect(await page.evaluate(() => document.querySelector('[data-testid="layout-verlauf"]')!.scrollTop)).toBeGreaterThan(0)
  })

  test('zeigt den Hinweis vor der Auswahl; das unvollstaendige Profil ist gesperrt mit Grund, Gesperrte und Admin fehlen', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 }, zusatzProfile: [UNVOLLSTAENDIG] })

    await expect(page.getByRole('heading', { level: 1, name: 'Team-Generator' })).toBeVisible()
    await expect(page.getByTestId('teams-manuell-hinweis')).toContainText('wird nicht gespeichert')
    await expect(page.getByTestId('admin-teams-profil-4')).toBeDisabled()
    await expect(page.getByTestId('admin-teams-unvollstaendig-4')).toHaveText('Skillwerte unvollständig')
    await expect(page.getByTestId('admin-teams-profil-2')).toHaveCount(0)
    await expect(page.getByTestId('admin-teams-profil-99')).toHaveCount(0)
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('teilt Profile und einen uebernommenen Gast ein: Koerper, Ergebnis mit Hinweis, Algorithmus, Fokus auf der Ueberschrift', async ({ page }) => {
    const { welt } = await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 } })

    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await gastAnlegen(page, '  Beispielgast  ', 'STARK')
    await expect(page.getByTestId('admin-teams-gast-1')).toContainText('Stufe: Stark')
    await page.getByTestId('admin-teams-berechnen').click()

    const ergebnis = page.getByTestId('admin-teams-ergebnis')
    await expect(ergebnis).toBeVisible()
    expect(welt.koerper.teamsManuell).toEqual([{ spielerIds: [1, 3], gaeste: [{ stufe: 'STARK', name: 'Beispielgast' }] }])
    await expect(ergebnis.getByRole('heading', { level: 2, name: 'Ergebnis' })).toBeFocused()
    await expect(page.getByTestId('teams-manuell-hinweis-ergebnis')).toContainText('wird nicht gespeichert')
    await expect(page.getByTestId('admin-teams-ergebnis-teams-b')).toContainText('Beispielgast (Gast)')
    await expect(page.getByTestId('admin-teams-verfahren')).toHaveText('Algorithmus-Typ: Standard')
    await expect(ergebnis).not.toContainText('Ungleichgewicht')
    // Keine Skillwerte in den Teamlisten; Kategorien stehen nur in den (eingeklappten) Teamstaerken (05.11.2026).
    for (const team of ['a', 'b']) {
      await expect(page.getByTestId(`admin-teams-ergebnis-teams-${team}`)).not.toContainText(/Angriff|Verteidigung|Torwart/)
    }
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('weicht die Regel des Servers von der Einstellung ab, steht der Erklaersatz da', async ({ page }) => {
    await start(page, '/admin/teams', {
      konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4, auswechselModus: 'ZULETZT_ANGEMELDET' },
    })

    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await page.getByTestId('admin-teams-berechnen').click()

    await expect(page.getByTestId('admin-teams-regel-abweichung')).toContainText('keine Anmeldereihenfolge; der Springer wurde zufällig gezogen')
  })

  test('jede Aenderung der Auswahl laesst das Ergebnis verschwinden (M12); ein zweiter Lauf sendet dieselbe Auswahl', async ({ page }) => {
    const { welt } = await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 } })
    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await page.getByTestId('admin-teams-berechnen').click()
    await expect(page.getByTestId('admin-teams-ergebnis')).toBeVisible()

    await page.getByTestId('admin-teams-berechnen').click()
    await expect.poll(() => welt.koerper.teamsManuell.length).toBe(2)
    expect(welt.koerper.teamsManuell[1]).toEqual(welt.koerper.teamsManuell[0])

    await page.getByTestId('admin-teams-profil-3').uncheck()
    await expect(page.getByTestId('admin-teams-ergebnis')).toHaveCount(0)
  })

  test('ausserhalb der Grenzen ist „Teams einteilen“ gesperrt (mit Grund), ein Tipp sendet nichts', async ({ page }) => {
    const { welt } = await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 4 } })
    const knopf = page.getByTestId('admin-teams-berechnen')

    await expect(knopf).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('admin-teams-grund')).toHaveText('Bitte wähle Spieler oder füge Gäste hinzu.')
    await expect(page.getByTestId('admin-teams-zaehler')).toHaveText('Ausgewählt: 0. Erlaubt: 2 bis 4.')
    await knopf.click({ force: true })

    await expect(page.getByTestId('admin-teams-ergebnis')).toHaveCount(0)
    expect(welt.koerper.teamsManuell).toEqual([])
  })

  test('die Gast-Eingabe laesst sich abbrechen; solange sie offen ist, sperrt „Teams einteilen“ mit Grund', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 8 } })
    await page.getByTestId('admin-teams-profil-1').check()
    await page.getByTestId('admin-teams-profil-3').check()
    await page.getByTestId('admin-teams-gast-hinzufuegen').click()

    await expect(page.getByTestId('admin-teams-gast-name')).toBeFocused()
    await expect(page.getByTestId('admin-teams-berechnen')).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('admin-teams-grund')).toHaveText('Bitte übernimm den Gast oder brich die Eingabe ab.')
    for (const id of ['admin-teams-gast-abbrechen', 'admin-teams-gast-uebernehmen']) {
      expect((await page.getByTestId(id).boundingBox())?.height ?? 0, id).toBeGreaterThanOrEqual(44)
    }

    await page.getByTestId('admin-teams-gast-abbrechen').click()
    await expect(page.getByTestId('admin-teams-gast-eingabe')).toHaveCount(0)
    await expect(page.getByTestId('admin-teams-gast-1')).toHaveCount(0)
    await expect(page.getByTestId('admin-teams-gast-hinzufuegen')).toBeFocused()
    await expect(page.getByTestId('admin-teams-berechnen')).not.toHaveAttribute('aria-disabled', 'true')
    expect(await ueberhangHorizontal(page)).toBe(0)
  })

  test('ein Gast laesst sich entfernen (Fokus auf „Gast hinzufuegen“); Tap-Ziele sind mindestens 44 px hoch, die Leiste verdeckt nichts', async ({ page }) => {
    await start(page, '/admin/teams', { konfiguration: { minTeilnehmer: 2, maxTeilnehmer: 8 } })
    for (let i = 0; i < 4; i += 1) await gastAnlegen(page)

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
