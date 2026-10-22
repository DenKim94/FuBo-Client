import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { mockServer } from '@/test/mocks/server'
import { beispielErgebnis, teamsAus, terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminTerminDetail from './AdminTerminDetail'
import { TEXT_ERGEBNIS_VERALTET } from './ErgebnisKorrekturFormular'

afterEach(() => {
  queryClient.clear()
})

/** Abgeschlossener Termin mit Ergebnis (Team A, deutlich) und Teams, wenn nichts anderes gesagt ist. */
function abgeschlossen(teil: Partial<TerminModell> = {}): TerminModell {
  const modell = terminModell({ terminId: 101, status: 'ABGESCHLOSSEN', ergebnis: { ...beispielErgebnis }, ...teil })
  if (teil.teams === undefined) modell.teams = teamsAus(modell)
  return modell
}

function rendern(modell: TerminModell) {
  const welt = adminWelt({ termine: [modell] })
  const lesen = terminHandlers(welt.termine)
  mockServer.use(...adminHandler(welt), ...lesen.handlers)
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

async function formularOeffnen() {
  fireEvent.click(await screen.findByTestId('admin-ergebnis-korrigieren'))
  return screen.findByTestId('admin-ergebnis-formular')
}

describe('TerminErgebnis – Anzeige (C8 10.2)', () => {
  test('mit Ergebnis: Satz, wer es erfasst hat, und „Ergebnis korrigieren“; der Admin erfasst nichts', async () => {
    rendern(abgeschlossen())

    expect(await screen.findByTestId('ergebnis-anzeige-satz')).toHaveTextContent('Team A hat deutlich gewonnen.')
    expect(screen.getByTestId('ergebnis-anzeige-erfasst')).toHaveTextContent('Beispielspieler 01')
    expect(screen.getByTestId('admin-ergebnis-korrigieren')).toHaveTextContent('Ergebnis korrigieren')
    expect(screen.queryByTestId('ergebnis-formular')).not.toBeInTheDocument()
    expect(screen.queryByTestId('ergebnis-anzeige-korrigiert')).not.toBeInTheDocument()
  })

  test('ein bereits korrigiertes Ergebnis nennt, wann zuletzt korrigiert wurde', async () => {
    rendern(abgeschlossen({ ergebnis: { ...beispielErgebnis, korrigiertAm: '2099-01-14T09:30:00Z', version: 2 } }))

    expect(await screen.findByTestId('ergebnis-anzeige-korrigiert')).toHaveTextContent('Zuletzt korrigiert am')
  })

  test('ohne Ergebnis: Hinweis, dass die Spieler es erfassen, und keine Korrektur', async () => {
    rendern(abgeschlossen({ ergebnis: null }))

    expect(await screen.findByTestId('admin-ergebnis-leer')).toHaveTextContent('Das erfassen die Spieler.')
    expect(screen.queryByTestId('admin-ergebnis-korrigieren')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-ergebnis-ohne-teams')).not.toBeInTheDocument()
  })

  test('ohne Ergebnis und ohne Teams: der Hinweis nennt, dass ohne Einteilung kein Ergebnis möglich ist', async () => {
    rendern(abgeschlossen({ ergebnis: null, teams: null }))

    expect(await screen.findByTestId('admin-ergebnis-ohne-teams')).toHaveTextContent('ohne sie kann kein Ergebnis erfasst werden')
  })

  test.each(['GEPLANT', 'ABGESAGT'] as const)('bei Status %s gibt es den Abschnitt nicht', async (status) => {
    rendern(terminModell({ terminId: 101, status }))

    await screen.findByTestId('admin-termin-verwaltung')
    expect(screen.queryByTestId('admin-ergebnis-abschnitt')).not.toBeInTheDocument()
  })
})

describe('TerminErgebnis – Korrektur', () => {
  test('das Formular ist mit dem aktuellen Stand vorbelegt; Speichern ist ohne Änderung aria-disabled mit Grund (E17)', async () => {
    const welt = rendern(abgeschlossen())

    await formularOeffnen()

    expect(screen.getByTestId('ergebnis-sieger-a')).toBeChecked()
    expect(screen.getByTestId('ergebnis-deutlich')).toBeChecked()
    const speichern = screen.getByTestId('admin-ergebnis-speichern')
    expect(speichern).toHaveAttribute('aria-disabled', 'true')
    expect(speichern).toHaveAccessibleDescription('Es gibt keine Änderung.')
    fireEvent.click(speichern)
    expect(screen.getByTestId('admin-ergebnis-dialog')).not.toBeVisible()
    expect(welt.protokoll.ergebnisKorrigiert).toEqual([])
  })

  test('nach einer Änderung öffnet Speichern die Bestätigung mit altem und neuem Satz und der Folge für die Bilanz', async () => {
    rendern(abgeschlossen())
    await formularOeffnen()

    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))
    const speichern = screen.getByTestId('admin-ergebnis-speichern')
    expect(speichern).not.toHaveAttribute('aria-disabled')
    await userEvent.click(speichern)

    const zusammenfassung = await screen.findByTestId('admin-ergebnis-zusammenfassung')
    expect(zusammenfassung).toHaveTextContent('von „Team A hat deutlich gewonnen.“ auf „Team B hat deutlich gewonnen.“')
    expect(zusammenfassung).toHaveTextContent('Die Bilanz der beteiligten Spieler wird angepasst.')
  })

  test('Erfolg: korrigiert gesendet mit version, Formular zu, „Ergebnis korrigiert.“, neuer Satz, Fokus auf der Überschrift', async () => {
    const welt = rendern(abgeschlossen())
    await formularOeffnen()

    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))
    await userEvent.click(screen.getByTestId('ergebnis-deutlich'))
    await userEvent.click(screen.getByTestId('admin-ergebnis-speichern'))
    await userEvent.click(await screen.findByTestId('admin-ergebnis-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-ergebnis-korrigiert')).toHaveTextContent('Ergebnis korrigiert.')
    expect(welt.protokoll.ergebnisKorrigiert).toEqual([{ terminId: 101, sieger: 'B', deutlich: false, version: 1 }])
    await waitFor(() => expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent('Team B hat gewonnen.'))
    expect(screen.queryByTestId('admin-ergebnis-formular')).not.toBeInTheDocument()
    expect(screen.getByTestId('ergebnis-anzeige-korrigiert')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('ergebnis-anzeige-titel')).toHaveFocus())
  })

  test('Unentschieden geht mit deutlich=false hinaus, auch wenn vorher „deutlich“ gesetzt war (M11)', async () => {
    const welt = rendern(abgeschlossen())
    await formularOeffnen()

    await userEvent.click(screen.getByTestId('ergebnis-sieger-u'))
    expect(screen.getByTestId('ergebnis-deutlich')).toBeDisabled()
    await userEvent.click(screen.getByTestId('admin-ergebnis-speichern'))
    await userEvent.click(await screen.findByTestId('admin-ergebnis-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-ergebnis-korrigiert')).toBeInTheDocument()
    expect(welt.protokoll.ergebnisKorrigiert).toEqual([{ terminId: 101, sieger: 'U', deutlich: false, version: 1 }])
    expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent('Unentschieden.')
  })

  test('Abbrechen klappt zu, sendet nichts und verwirft die Eingaben', async () => {
    const welt = rendern(abgeschlossen())
    await formularOeffnen()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))

    await userEvent.click(screen.getByTestId('admin-ergebnis-abbrechen'))
    expect(screen.queryByTestId('admin-ergebnis-formular')).not.toBeInTheDocument()
    await formularOeffnen()

    expect(screen.getByTestId('ergebnis-sieger-a')).toBeChecked()
    expect(welt.protokoll.ergebnisKorrigiert).toEqual([])
  })

  test('E5 – DATEN_VERALTET: der Dialog schließt, das Formular steht mit dem frischen Stand da, der Text erklärt es; die alten Eingaben werden nie mit neuer Version gesendet', async () => {
    const welt = rendern(abgeschlossen())
    await formularOeffnen()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))
    // Währenddessen korrigiert jemand anderes auf Unentschieden (version 2).
    welt.fremdeErgebnisAenderung(101, { sieger: 'U', deutlich: false })

    await userEvent.click(screen.getByTestId('admin-ergebnis-speichern'))
    await userEvent.click(await screen.findByTestId('admin-ergebnis-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-ergebnis-veraltet')).toHaveTextContent(TEXT_ERGEBNIS_VERALTET)
    // Neu aufgebaut aus dem frischen Stand: Unentschieden, nicht die eigene Wahl „Team B“.
    await waitFor(() => expect(screen.getByTestId('ergebnis-sieger-u')).toBeChecked())
    expect(screen.getByTestId('ergebnis-sieger-b')).not.toBeChecked()
    expect(screen.getByTestId('admin-ergebnis-speichern')).toHaveAttribute('aria-disabled', 'true')
    expect(welt.protokoll.ergebnisKorrigiert).toHaveLength(1)

    // Mit der nächsten Eingabe verschwindet der Text; gesendet wird mit der neuen Version und der neuen Eingabe.
    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))
    expect(screen.queryByTestId('admin-ergebnis-veraltet')).not.toBeInTheDocument()
    await userEvent.click(screen.getByTestId('admin-ergebnis-speichern'))
    await userEvent.click(await screen.findByTestId('admin-ergebnis-dialog-bestaetigen'))
    expect(await screen.findByTestId('admin-ergebnis-korrigiert')).toBeInTheDocument()
    expect(welt.protokoll.ergebnisKorrigiert).toEqual([
      { terminId: 101, sieger: 'B', deutlich: true, version: 1 },
      { terminId: 101, sieger: 'A', deutlich: false, version: 2 },
    ])
  })
})
