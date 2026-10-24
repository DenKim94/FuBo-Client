import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { adminHandler, adminWelt, beispielGastplaetze, gastPlatz } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminGaeste from './AdminGaeste'

afterEach(() => {
  queryClient.clear()
})

/** Position des Gastes `Beispielgast` im Beispieltermin: sieben Spieler davor. */
const POSITION = 8

/** Rendert die Seite als Admin: Der Server liefert `gastStufe` je Gast (Vertrag seit 24.10.2026); `false` prüft die Rückfallebene. */
function rendern(modelle: TerminModell[], gastplaetze = beispielGastplaetze(), optionen: { gastStufeFuerAdmin?: boolean } = { gastStufeFuerAdmin: true }) {
  const welt = adminWelt({ termine: modelle, gastplaetze })
  const lesen = terminHandlers(welt.termine, optionen)
  // Erst die Admin-Handler, dann die Termine (MSW nimmt den ersten passenden).
  mockServer.use(...adminHandler(welt), ...lesen.handlers)
  render(
    <QueryUmgebung>
      <MemoryRouter>
        <AdminGaeste />
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return { welt, protokoll: lesen.protokoll }
}

async function dialogOeffnen(terminId = 101, position = POSITION) {
  fireEvent.click(await screen.findByTestId(`admin-gast-stufe-${String(terminId)}-${String(position)}`))
  return screen.findByTestId('admin-gast-stufe-dialog')
}

describe('Gäste in Terminen – Anzeige', () => {
  test('zeigt je geplantem Termin mit Gast Datum, Uhrzeit und den Gast mit „(Gast)“, ohne Spieler', async () => {
    rendern([terminModell({ terminId: 101 })])

    const termin = await screen.findByTestId('admin-gaeste-termin-101')
    expect(within(termin).getByRole('heading', { level: 3 })).toHaveTextContent('19:00 Uhr')
    expect(termin).toHaveTextContent('Beispielgast (Gast)')
    expect(termin).not.toHaveTextContent('Beispielspieler')
  })

  test('auch ohne belegten Gastplatz: Ein abgemeldeter Gast mit Zusage erscheint (Befund vom 24.10.2026)', async () => {
    rendern([terminModell({ terminId: 101 })], [gastPlatz({ nummer: 1 }), gastPlatz({ nummer: 2 })])

    expect(await screen.findByTestId('admin-gaeste-termin-101')).toHaveTextContent('Beispielgast (Gast)')
    expect(screen.getByTestId('admin-gaeste-zusammenfassung')).toHaveTextContent('0 von 2 Plätzen belegt')
  })

  test('mehrere Termine: jeder mit eigener Überschrift, Test-IDs je Termin eindeutig', async () => {
    rendern([terminModell({ terminId: 101 }), terminModell({ terminId: 102, datum: '2099-01-20' })])

    await screen.findByTestId('admin-gaeste-termin-102')
    expect(screen.getByTestId('admin-gaeste-termin-101')).toBeInTheDocument()
    expect(screen.getByTestId(`admin-gast-stufe-101-${String(POSITION)}`)).toBeInTheDocument()
    expect(screen.getByTestId(`admin-gast-stufe-102-${String(POSITION)}`)).toBeInTheDocument()
  })

  test('ohne Gast, ohne Zusagen oder nicht geplant: kein Termin, stattdessen der Leertext', async () => {
    const { protokoll } = rendern([
      terminModell({ terminId: 101, zusagen: [{ name: 'Beispielspieler 11', gast: false }] }),
      terminModell({ terminId: 102, datum: '2099-01-20', zusagen: [] }),
      terminModell({ terminId: 103, datum: '2099-01-27', status: 'ABGESAGT' }),
    ])

    expect(await screen.findByTestId('admin-gaeste-termine-leer')).toHaveTextContent('Für kommende Termine hat kein Gast zugesagt.')
    // Nur der geplante Termin mit Zusagen wird einzeln gelesen.
    expect(protokoll.detailabrufe).toHaveLength(1)
  })

  test('ein Gast in der Warteschlange trägt den Hinweis „wartet“', async () => {
    rendern([terminModell({ terminId: 101, max: 7 })])

    expect(await screen.findByTestId('admin-gaeste-termin-101')).toHaveTextContent('wartet')
  })

  test('Lesen im Admin: Liste mit Stichtag, ohne Kopf X-FuBo-Kein-Refresh', async () => {
    const { protokoll } = rendern([terminModell({ terminId: 101 })])

    await screen.findByTestId('admin-gaeste-termin-101')
    expect(protokoll.listenabrufe.every((kopf) => kopf === null)).toBe(true)
    expect(protokoll.detailabrufe.every((kopf) => kopf === null)).toBe(true)
    expect(protokoll.stichtage.every((ab) => ab !== null)).toBe(true)
  })
})

describe('Gäste in Terminen – Dialog', () => {
  test('wählt die Stufe der Teilnahme vor, die der Server liefert (auch gegen einen Gastplatz mit anderer Stufe)', async () => {
    rendern([terminModell({ terminId: 101 })])

    await dialogOeffnen()

    // Teilnahme ohne eigene Angabe: MITTEL (wie am Server); Platz 1 meldet STARK und zählt nicht.
    expect(screen.getByTestId('admin-gast-stufe-wahl-MITTEL')).toBeChecked()
    expect(screen.queryByText(/liegt nicht vor/)).not.toBeInTheDocument()
  })

  test('Rückfall ohne Feld vom Server: Vorauswahl aus einem belegten Platz gleichen Namens', async () => {
    rendern([terminModell({ terminId: 101 })], beispielGastplaetze(), { gastStufeFuerAdmin: false })

    await dialogOeffnen()

    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-STARK')).toBeChecked()
    })
    expect(screen.queryByText(/liegt nicht vor/)).not.toBeInTheDocument()
  })

  test('Rückfall ohne Feld und ohne Platz gleichen Namens: keine Vorauswahl, erklärender Text', async () => {
    rendern([terminModell({ terminId: 101 })], [gastPlatz({ nummer: 1 }), gastPlatz({ nummer: 2 })], { gastStufeFuerAdmin: false })

    const dialog = await dialogOeffnen()

    expect(within(dialog).getByText('Die aktuelle Stufe liegt nicht vor. Bitte wähle eine.')).toBeInTheDocument()
    for (const stufe of ['STARK', 'MITTEL', 'SCHWACH']) {
      expect(screen.getByTestId(`admin-gast-stufe-wahl-${stufe}`)).not.toBeChecked()
    }
  })

  test('Rückfall ohne Feld: ein Platz gleichen Namens, der nicht belegt ist, liefert keine Vorauswahl', async () => {
    rendern([terminModell({ terminId: 101 })], [gastPlatz({ nummer: 1, gastName: 'Beispielgast', gastStufe: 'STARK', belegt: false })], { gastStufeFuerAdmin: false })

    const dialog = await dialogOeffnen()

    expect(within(dialog).getByText(/liegt nicht vor/)).toBeInTheDocument()
    expect(screen.getByTestId('admin-gast-stufe-wahl-STARK')).not.toBeChecked()
  })

  test('der Dialog nennt die Folgen für die Teameinteilung (Text des Entwicklers vom 24.10.2026)', async () => {
    rendern([terminModell({ terminId: 101 })])

    const dialog = await dialogOeffnen()

    expect(dialog).toHaveTextContent('Nach Änderung gilt die vorhandene Teameinteilung als veraltet.')
    expect(dialog).toHaveTextContent('Die Teams müssen anschließend neu generiert werden.')
  })

  test('„Speichern“ ohne Wahl (Rückfall ohne bekannte Stufe) sendet nichts und meldet es am Feld', async () => {
    const { welt } = rendern([terminModell({ terminId: 101 })], [], { gastStufeFuerAdmin: false })
    await dialogOeffnen()

    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    expect(await screen.findByText('Bitte wähle eine Stufe.')).toBeInTheDocument()
    expect(welt.protokoll.gastStufen).toEqual([])
  })
})

describe('Gäste in Terminen – Speichern', () => {
  test('sendet Termin, den Namen unverändert (ohne „(Gast)“) und die gewählte Stufe; der Dialog schließt', async () => {
    const { welt } = rendern([terminModell({ terminId: 101 })])
    await dialogOeffnen()
    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-MITTEL')).toBeChecked()
    })

    fireEvent.click(screen.getByTestId('admin-gast-stufe-wahl-SCHWACH'))
    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    await waitFor(() => {
      expect(welt.protokoll.gastStufen).toEqual([{ terminId: 101, gastName: 'Beispielgast', stufe: 'SCHWACH' }])
    })
    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen')).not.toBeVisible()
    })
    expect(welt.termine[0].teilnehmerVersion).toBe(2)
    expect(welt.termine[0].zusagen.find((z) => z.gast)?.stufe).toBe('SCHWACH')
  })

  test('der Name geht zeichengenau hinaus, auch mit doppeltem Leerzeichen', async () => {
    const { welt } = rendern(
      [terminModell({ terminId: 101, zusagen: [{ name: 'Beispiel  gast', gast: true }] })],
      [gastPlatz({ nummer: 1, belegt: true, gastName: 'Beispiel  gast', gastStufe: 'MITTEL', sitzungGueltig: true })],
    )
    await dialogOeffnen(101, 1)
    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-MITTEL')).toBeChecked()
    })

    fireEvent.click(screen.getByTestId('admin-gast-stufe-wahl-STARK'))
    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    await waitFor(() => {
      expect(welt.protokoll.gastStufen).toEqual([{ terminId: 101, gastName: 'Beispiel  gast', stufe: 'STARK' }])
    })
  })

  test('404: Der Gast hat zurückgezogen – der Dialog zeigt den Text des Servers, die Zeile verschwindet', async () => {
    const { welt } = rendern([terminModell({ terminId: 101 }), terminModell({ terminId: 102, datum: '2099-01-20' })])
    await dialogOeffnen()
    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-MITTEL')).toBeChecked()
    })
    // Der Gast zieht seine Zusage zurück, während der Dialog offen ist.
    welt.termine[0].zusagen = welt.termine[0].zusagen.filter((z) => !z.gast)

    fireEvent.click(screen.getByTestId('admin-gast-stufe-wahl-SCHWACH'))
    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-gast-stufe-dialog-fehler')).toHaveTextContent('keine Teilnahme dieses Gastes vor')
    await waitFor(() => {
      expect(screen.queryByTestId('admin-gaeste-termin-101')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('admin-gaeste-termin-102')).toBeInTheDocument()
  })
})

describe('Gäste in Terminen – Entfernen (Absage für den Gast, Vertrag seit 24.10.2026)', () => {
  async function entfernenOeffnen(terminId = 101, position = POSITION) {
    fireEvent.click(await screen.findByTestId(`admin-gast-entfernen-${String(terminId)}-${String(position)}`))
    return screen.findByTestId('admin-gast-entfernen-dialog')
  }

  test('je Gast steht „Entfernen“ neben „Stufe ändern“; der zugängliche Name enthält die sichtbare Beschriftung und den Gast', async () => {
    rendern([terminModell({ terminId: 101 })])

    expect(await screen.findByRole('button', { name: 'Entfernen: Beispielgast (Gast) aus dem Termin' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stufe ändern: Beispielgast (Gast)' })).toBeInTheDocument()
  })

  test('der Dialog nennt Gast, Termin und die Folgen; „Abbrechen“ sendet nichts', async () => {
    const { welt } = rendern([terminModell({ terminId: 101 })])

    const dialog = await entfernenOeffnen()
    expect(dialog).toHaveTextContent('Beispielgast (Gast) wird für')
    expect(dialog).toHaveTextContent('aus dem Termin entfernt.')
    expect(dialog).toHaveTextContent('Wer wartet, rückt nach')
    expect(dialog).toHaveTextContent('gilt danach als veraltet')

    fireEvent.click(screen.getByTestId('admin-gast-entfernen-dialog-abbrechen'))
    expect(welt.protokoll.gastAbgesagt).toEqual([])
  })

  test('sendet Termin und Namen unverändert; die Zeile verschwindet, der Hinweis steht da, der Fokus liegt auf der Abschnittsüberschrift', async () => {
    const { welt } = rendern([terminModell({ terminId: 101 }), terminModell({ terminId: 102, datum: '2099-01-20' })])
    await entfernenOeffnen()

    fireEvent.click(screen.getByTestId('admin-gast-entfernen-dialog-bestaetigen'))

    await waitFor(() => {
      expect(screen.queryByTestId('admin-gaeste-termin-101')).not.toBeInTheDocument()
    })
    expect(welt.protokoll.gastAbgesagt).toEqual([{ terminId: 101, gastName: 'Beispielgast' }])
    expect(screen.getByTestId('admin-gaeste-termine-hinweis')).toHaveTextContent('Beispielgast (Gast) ist am')
    expect(screen.getByTestId('admin-gaeste-termine-hinweis')).toHaveTextContent('nicht mehr dabei.')
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Gäste in Terminen' })).toHaveFocus()
    })
    // Der andere Termin bleibt; der Kreis des betroffenen ist kleiner, die Einteilung veraltet, das Kontingent bleibt.
    expect(screen.getByTestId('admin-gaeste-termin-102')).toBeInTheDocument()
    expect(welt.termine[0].teilnehmerVersion).toBe(2)
    expect(welt.termine[0].kontingentVersion).toBe(1)
    expect(welt.termine[0].zusagen.some((z) => z.gast)).toBe(false)
  })

  test('der letzte Gast: danach steht der Leertext', async () => {
    rendern([terminModell({ terminId: 101 })])
    await entfernenOeffnen()

    fireEvent.click(screen.getByTestId('admin-gast-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-gaeste-termine-leer')).toBeInTheDocument()
    expect(screen.getByTestId('admin-gaeste-termine-hinweis')).toHaveTextContent('nicht mehr dabei.')
  })

  test('404: Der Gast ist schon weg – der Dialog zeigt den Text des Servers, die Zeile verschwindet nach dem Neulesen', async () => {
    const { welt } = rendern([terminModell({ terminId: 101 })])
    await entfernenOeffnen()
    welt.termine[0].zusagen = welt.termine[0].zusagen.filter((z) => !z.gast)

    fireEvent.click(screen.getByTestId('admin-gast-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-gast-entfernen-dialog-fehler')).toHaveTextContent('keine Zusage dieses Gastes vor')
    await waitFor(() => {
      expect(screen.queryByTestId('admin-gaeste-termin-101')).not.toBeInTheDocument()
    })
  })

  test('409 TERMIN_GESCHLOSSEN: Text des Servers im Dialog, der Termin wird neu gelesen und fällt aus der Liste', async () => {
    const { welt } = rendern([terminModell({ terminId: 101 })])
    await entfernenOeffnen()
    welt.termine[0].status = 'ABGESAGT'

    fireEvent.click(screen.getByTestId('admin-gast-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-gast-entfernen-dialog-fehler')).toHaveTextContent('nimmt keine Rückmeldungen mehr an')
    await waitFor(() => {
      expect(screen.queryByTestId('admin-gaeste-termin-101')).not.toBeInTheDocument()
    })
  })

  test('ein anderer Fehler bleibt im offenen Dialog; die Zeile bleibt', async () => {
    rendern([terminModell({ terminId: 101 })])
    await entfernenOeffnen()
    mockServer.use(http.post('*/admin/teilnahme/gast-absagen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))

    fireEvent.click(screen.getByTestId('admin-gast-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-gast-entfernen-dialog-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('admin-gast-entfernen-dialog-bestaetigen')).toBeVisible()
    expect(screen.getByTestId('admin-gaeste-termin-101')).toBeInTheDocument()
  })
})

describe('Gäste in Terminen – Stufe sichtbar (24.10.2026)', () => {
  const anzeige = (terminId = 101, position = POSITION) => `admin-gast-stufe-anzeige-${String(terminId)}-${String(position)}`

  test('Rückfall ohne Feld, angemeldeter Gast: die Stufe aus dem belegten Gastplatz', async () => {
    rendern([terminModell({ terminId: 101 })], beispielGastplaetze(), { gastStufeFuerAdmin: false })

    expect(await screen.findByTestId(anzeige())).toHaveTextContent('Aktuelle Stufe: Stark')
  })

  test('Rückfall ohne Feld, abgemeldeter Gast: „nicht bekannt“ mit Grund statt einer erfundenen Stufe', async () => {
    rendern([terminModell({ terminId: 101 })], [gastPlatz({ nummer: 1 }), gastPlatz({ nummer: 2 })], { gastStufeFuerAdmin: false })

    expect(await screen.findByTestId(anzeige())).toHaveTextContent('Stufe: nicht bekannt (der Gast ist nicht angemeldet)')
  })

  test('die Stufe der Teilnahme vom Server gilt – auch gegen einen Gastplatz mit anderer Stufe', async () => {
    const modell = terminModell({ terminId: 101 })
    const gast = modell.zusagen.find((z) => z.gast)
    if (gast) gast.stufe = 'SCHWACH'
    // Platz 1 meldet „Stark“ (Selbsteinschätzung), die Teilnahme „Schwach“ (vom Admin korrigiert).
    rendern([modell], beispielGastplaetze(), { gastStufeFuerAdmin: true })

    expect(await screen.findByTestId(anzeige())).toHaveTextContent('Aktuelle Stufe: Schwach')
    expect(screen.getByTestId(anzeige())).not.toHaveTextContent('Selbsteinschätzung')

    // Die Vorauswahl im Dialog folgt derselben Quelle.
    await dialogOeffnen()
    expect(screen.getByTestId('admin-gast-stufe-wahl-SCHWACH')).toBeChecked()
  })

  test('mit Server-Feld auch für einen abgemeldeten Gast sichtbar', async () => {
    rendern([terminModell({ terminId: 101 })], [gastPlatz({ nummer: 1 })], { gastStufeFuerAdmin: true })

    expect(await screen.findByTestId(anzeige())).toHaveTextContent('Aktuelle Stufe: Mittel')
  })

  test('nach „Stufe ändern“ zeigt die Zeile die neue Stufe (Server-Feld)', async () => {
    rendern([terminModell({ terminId: 101 })], beispielGastplaetze(), { gastStufeFuerAdmin: true })
    await dialogOeffnen()

    fireEvent.click(screen.getByTestId('admin-gast-stufe-wahl-SCHWACH'))
    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    await waitFor(() => {
      expect(screen.getByTestId(anzeige())).toHaveTextContent('Aktuelle Stufe: Schwach')
    })
  })
})
