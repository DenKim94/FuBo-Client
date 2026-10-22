import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { adminHandler, adminWelt, beispielGastplaetze, gastPlatz } from '@/test/mocks/admin'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminTerminDetail from './AdminTerminDetail'

afterEach(() => {
  queryClient.clear()
})

/** Position des Gastes `Beispielgast` im Beispieltermin: sieben Spieler davor. */
const POSITION = 8

function rendern(modelle: TerminModell[], gastplaetze = beispielGastplaetze()) {
  const welt = adminWelt({ termine: modelle, gastplaetze })
  const lesen = terminHandlers(welt.termine)
  mockServer.use(...lesen.handlers, ...adminHandler(welt))
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={['/admin/termine/101']}>
        <Routes>
          <Route path="/admin/termine/:terminId" element={<AdminTerminDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

async function dialogOeffnen() {
  fireEvent.click(await screen.findByTestId(`admin-gast-stufe-${String(POSITION)}`))
  return screen.findByTestId('admin-gast-stufe-dialog')
}

describe('GastStufeListe – Abschnitt', () => {
  test('zeigt bei einem geplanten Termin mit Gast den Abschnitt „Gäste“, Name mit „(Gast)“, ohne Spieler', async () => {
    rendern([terminModell({ terminId: 101 })])

    const abschnitt = await screen.findByTestId('admin-termin-gaeste-abschnitt')
    expect(within(abschnitt).getByRole('heading', { level: 2, name: 'Gäste' })).toBeInTheDocument()
    expect(abschnitt).toHaveTextContent('Beispielgast (Gast)')
    expect(abschnitt).not.toHaveTextContent('Beispielspieler')
    expect(within(abschnitt).getAllByRole('listitem')).toHaveLength(1)
  })

  test('steht zwischen „Termin ändern“ und „Weitere Aktionen“', async () => {
    rendern([terminModell({ terminId: 101 })])

    await screen.findByTestId('admin-termin-gaeste-abschnitt')
    const titel = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titel).toEqual(['Termin ändern', 'Gäste', 'Weitere Aktionen'])
  })

  test('ohne Gast in der Teilnehmerliste gibt es keinen Abschnitt', async () => {
    rendern([terminModell({ terminId: 101, zusagen: [{ name: 'Beispielspieler 11', gast: false }] })])

    await screen.findByTestId('admin-termin-verwaltung')
    expect(screen.queryByTestId('admin-termin-gaeste-abschnitt')).not.toBeInTheDocument()
  })

  test.each(['ABGESAGT', 'ABGESCHLOSSEN'] as const)('bei Status %s gibt es keinen Abschnitt', async (status) => {
    rendern([terminModell({ terminId: 101, status })])

    await screen.findByTestId('admin-termin-verwaltung')
    expect(screen.queryByTestId('admin-termin-gaeste-abschnitt')).not.toBeInTheDocument()
  })

  test('ein Gast in der Warteschlange trägt den Hinweis „wartet“', async () => {
    rendern([terminModell({ terminId: 101, max: 7 })])

    expect(await screen.findByTestId('admin-termin-gaeste-abschnitt')).toHaveTextContent('wartet')
  })
})

describe('GastStufeListe – Dialog', () => {
  test('die Gastplätze werden erst beim Öffnen des Dialogs gelesen', async () => {
    const welt = rendern([terminModell({ terminId: 101 })])
    await screen.findByTestId('admin-termin-gaeste-abschnitt')
    expect(welt.protokoll.gaesteAbrufe).toEqual([])

    await dialogOeffnen()

    await waitFor(() => {
      expect(welt.protokoll.gaesteAbrufe).toEqual([null])
    })
  })

  test('wählt die Stufe vor, wenn ein belegter Platz gleichen Namens sie nennt', async () => {
    rendern([terminModell({ terminId: 101 })])

    await dialogOeffnen()

    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-STARK')).toBeChecked()
    })
    expect(screen.queryByText(/liegt nicht vor/)).not.toBeInTheDocument()
  })

  test('ohne Platz gleichen Namens gibt es keine Vorauswahl und einen erklärenden Text', async () => {
    rendern([terminModell({ terminId: 101 })], [gastPlatz({ nummer: 1 }), gastPlatz({ nummer: 2 })])

    const dialog = await dialogOeffnen()

    expect(await within(dialog).findByText('Die aktuelle Stufe liegt nicht vor. Bitte wähle eine.')).toBeInTheDocument()
    for (const stufe of ['STARK', 'MITTEL', 'SCHWACH']) {
      expect(screen.getByTestId(`admin-gast-stufe-wahl-${stufe}`)).not.toBeChecked()
    }
  })

  test('ein Platz gleichen Namens, der nicht belegt ist, liefert keine Vorauswahl', async () => {
    rendern([terminModell({ terminId: 101 })], [gastPlatz({ nummer: 1, gastName: 'Beispielgast', gastStufe: 'STARK', belegt: false })])

    const dialog = await dialogOeffnen()

    expect(await within(dialog).findByText(/liegt nicht vor/)).toBeInTheDocument()
    expect(screen.getByTestId('admin-gast-stufe-wahl-STARK')).not.toBeChecked()
  })

  test('der Dialog nennt die Folgen für die Teameinteilung', async () => {
    rendern([terminModell({ terminId: 101 })])

    const dialog = await dialogOeffnen()

    expect(dialog).toHaveTextContent('Eine vorhandene Teameinteilung gilt danach als veraltet')
    expect(dialog).toHaveTextContent('Beispielgast (Gast)')
  })

  test('„Speichern“ ohne Wahl sendet nichts und meldet es am Feld', async () => {
    const welt = rendern([terminModell({ terminId: 101 })], [])
    await dialogOeffnen()
    await screen.findByText(/liegt nicht vor/)

    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    expect(await screen.findByText('Bitte wähle eine Stufe.')).toBeInTheDocument()
    expect(welt.protokoll.gastStufen).toEqual([])
  })
})

describe('GastStufeListe – Speichern', () => {
  test('sendet Termin, den Namen unverändert (ohne „(Gast)“) und die gewählte Stufe; der Dialog schließt', async () => {
    const welt = rendern([terminModell({ terminId: 101 })])
    await dialogOeffnen()
    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-STARK')).toBeChecked()
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
    const welt = rendern(
      [terminModell({ terminId: 101, zusagen: [{ name: 'Beispiel  gast', gast: true }] })],
      [gastPlatz({ nummer: 1, belegt: true, gastName: 'Beispiel  gast', gastStufe: 'MITTEL', sitzungGueltig: true })],
    )
    fireEvent.click(await screen.findByTestId('admin-gast-stufe-1'))
    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-MITTEL')).toBeChecked()
    })

    fireEvent.click(screen.getByTestId('admin-gast-stufe-wahl-STARK'))
    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    await waitFor(() => {
      expect(welt.protokoll.gastStufen).toEqual([{ terminId: 101, gastName: 'Beispiel  gast', stufe: 'STARK' }])
    })
  })

  test('404: Der Gast hat sich abgemeldet – der Dialog zeigt den Text des Servers, der Termin wird neu gelesen und die Zeile verschwindet', async () => {
    const welt = rendern([terminModell({ terminId: 101 })])
    await dialogOeffnen()
    await waitFor(() => {
      expect(screen.getByTestId('admin-gast-stufe-wahl-STARK')).toBeChecked()
    })
    // Der Gast meldet sich ab, während der Dialog offen ist.
    welt.termine[0].zusagen = welt.termine[0].zusagen.filter((z) => !z.gast)

    fireEvent.click(screen.getByTestId('admin-gast-stufe-wahl-MITTEL'))
    fireEvent.click(screen.getByTestId('admin-gast-stufe-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-gast-stufe-dialog-fehler')).toHaveTextContent('keine Teilnahme dieses Gastes vor')
    await waitFor(() => {
      expect(screen.queryByTestId(`admin-gast-stufe-${String(POSITION)}`)).not.toBeInTheDocument()
    })
  })
})
