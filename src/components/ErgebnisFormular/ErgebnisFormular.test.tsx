import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useTermin } from '@/hooks/useTermin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { EIGENER_NAME, teamsAus, terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import ErgebnisFormular from './ErgebnisFormular'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Rendert das Formular gegen einen abgeschlossenen Termin mit Einteilung (Serverzustand der Mocks). */
function rendern() {
  const modell = terminModell({ terminId: 102, status: 'ABGESCHLOSSEN', datum: '2000-01-01' })
  modell.zusagen.unshift({ name: EIGENER_NAME, gast: false })
  modell.teams = teamsAus(modell)
  const welt = terminHandlers([modell])
  mockServer.use(...welt.handlers)
  const beiAbschluss = vi.fn()
  render(<ErgebnisFormular terminId={102} beiAbschluss={beiAbschluss} />, { wrapper: QueryUmgebung })
  return { welt, beiAbschluss }
}

/** Zeigt das Formular nur, solange der Termin kein Ergebnis hat – wie die Seite, die es gegen die Anzeige tauscht. */
function Huelle({ beiAbschluss }: { beiAbschluss: (vorhanden: boolean) => void }) {
  const termin = useTermin(102)
  if (!termin.data) return null
  return termin.data.ergebnis ? <p data-testid="huelle-anzeige">Anzeige</p> : <ErgebnisFormular terminId={102} beiAbschluss={beiAbschluss} />
}

describe('ErgebnisFormular: Eingabe', () => {
  test('sperrt ohne Auswahl die Aktion mit Grund, der Fokus bleibt moeglich', async () => {
    const { welt } = rendern()
    const knopf = screen.getByTestId('ergebnis-absenden')

    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).not.toBeDisabled()
    expect(screen.getByTestId('ergebnis-grund')).toHaveTextContent('Bitte wähle den Ausgang.')

    await userEvent.click(knopf)
    expect(screen.getByTestId('ergebnis-dialog')).not.toHaveAttribute('open')
    expect(welt.protokoll.erfassungen).toHaveLength(0)
  })

  test('benennt die Gruppe mit „Wer hat gewonnen?“ und bietet drei Optionen als Radios', () => {
    rendern()
    const gruppe = screen.getByRole('group', { name: 'Wer hat gewonnen?' })
    expect(gruppe).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Team A' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Unentschieden' })).toBeInTheDocument()
  })

  test('gibt die Aktion mit der Auswahl frei und nimmt den Grund weg', async () => {
    rendern()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))

    expect(screen.getByTestId('ergebnis-absenden')).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByTestId('ergebnis-grund')).not.toBeInTheDocument()
  })

  test('sperrt bei Unentschieden den Haken, setzt ihn zurueck und nennt den Grund als Text', async () => {
    rendern()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-deutlich'))
    expect(screen.getByTestId('ergebnis-deutlich')).toBeChecked()

    await userEvent.click(screen.getByTestId('ergebnis-sieger-u'))
    expect(screen.getByTestId('ergebnis-deutlich')).toBeDisabled()
    expect(screen.getByTestId('ergebnis-deutlich')).not.toBeChecked()
    expect(screen.getByTestId('ergebnis-deutlich-grund')).toHaveTextContent('Nur bei einem Sieg möglich.')

    // Zurueck zu einem Sieg: Der Haken ist frei, aber nicht von selbst wieder gesetzt.
    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))
    expect(screen.getByTestId('ergebnis-deutlich')).toBeEnabled()
    expect(screen.getByTestId('ergebnis-deutlich')).not.toBeChecked()
    expect(screen.queryByTestId('ergebnis-deutlich-grund')).not.toBeInTheDocument()
  })

  test('zeigt dauerhaft, dass der erste Eintrag gilt', () => {
    rendern()
    expect(screen.getByTestId('ergebnis-hinweis')).toHaveTextContent(
      'Der erste Eintrag gilt. Ein Ergebnis lässt sich nicht löschen, nur der Admin kann es korrigieren.',
    )
  })
})

describe('ErgebnisFormular: Eintragen', () => {
  test('fragt vor dem Senden mit dem Satz nach, der nachher dasteht', async () => {
    const { welt } = rendern()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-deutlich'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))

    expect(screen.getByTestId('ergebnis-dialog')).toHaveAttribute('open')
    expect(screen.getByTestId('ergebnis-zusammenfassung')).toHaveTextContent('Team A hat deutlich gewonnen.')
    expect(welt.protokoll.erfassungen).toHaveLength(0)
  })

  test('sendet nach der Bestaetigung ohne Hintergrundkopf und meldet den Abschluss', async () => {
    const { welt, beiAbschluss } = rendern()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-deutlich'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    await waitFor(() => expect(beiAbschluss).toHaveBeenCalledWith(false))
    expect(beiAbschluss).toHaveBeenCalledTimes(1)
    expect(welt.protokoll.erfassungen).toEqual([{ terminId: 102, sieger: 'A', deutlich: true, kopf: null }])
    expect(screen.getByTestId('ergebnis-dialog')).not.toHaveAttribute('open')
  })

  test('schickt bei Unentschieden deutlich = false', async () => {
    const { welt, beiAbschluss } = rendern()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-deutlich'))
    await userEvent.click(screen.getByTestId('ergebnis-sieger-u'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    expect(screen.getByTestId('ergebnis-zusammenfassung')).toHaveTextContent(/^Unentschieden\.$/)
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    await waitFor(() => expect(beiAbschluss).toHaveBeenCalled())
    expect(welt.protokoll.erfassungen[0]).toMatchObject({ sieger: 'U', deutlich: false })
  })

  test('schliesst mit „Zurueck“ ohne Anfrage und behaelt die Eingabe', async () => {
    const { welt, beiAbschluss } = rendern()
    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-zurueck'))

    expect(screen.getByTestId('ergebnis-dialog')).not.toHaveAttribute('open')
    expect(screen.getByTestId('ergebnis-sieger-b')).toBeChecked()
    expect(welt.protokoll.erfassungen).toHaveLength(0)
    expect(beiAbschluss).not.toHaveBeenCalled()
  })

  test('behandelt ERGEBNIS_VORHANDEN als Hinweis und nicht als Fehler', async () => {
    const { beiAbschluss } = rendern()
    mockServer.use(
      http.post('*/ergebnis/erfassen', () =>
        problem(409, 'ERGEBNIS_VORHANDEN', 'Das Ergebnis wurde bereits von Beispielspieler 01 erfasst.'),
      ),
    )
    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    await waitFor(() => expect(beiAbschluss).toHaveBeenCalledWith(true))
    expect(screen.queryByTestId('ergebnis-fehler')).not.toBeInTheDocument()
    expect(screen.getByTestId('ergebnis-dialog')).not.toHaveAttribute('open')
  })

  test('zeigt jeden anderen Fehler als Meldung und erlaubt den naechsten Versuch', async () => {
    const { welt, beiAbschluss } = rendern()
    mockServer.use(
      http.post('*/ergebnis/erfassen', () =>
        problem(409, 'KEINE_EINTEILUNG', 'Für diesen Termin gibt es keine Einteilung.'),
      ),
    )
    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    expect(await screen.findByTestId('ergebnis-fehler')).toHaveTextContent('keine Einteilung')
    expect(beiAbschluss).not.toHaveBeenCalled()
    expect(screen.getByTestId('ergebnis-dialog')).not.toHaveAttribute('open')
    expect(screen.getByTestId('ergebnis-absenden')).not.toHaveAttribute('aria-disabled')
    expect(welt.protokoll.erfassungen).toHaveLength(0) // der Override hat die Mock-Welt umgangen
  })

  test('traegt die Leiste als letztes Element seines Fragments', () => {
    rendern()
    const leiste = screen.getByTestId('aktionsleiste')
    expect(leiste.nextElementSibling).toBeNull()
  })
})

describe('ErgebnisFormular: Abschluss trotz Austausch', () => {
  test('meldet den Abschluss auch dann, wenn die Seite das Formular beim Neulesen schon ausgetauscht hat', async () => {
    const modell = terminModell({ terminId: 102, status: 'ABGESCHLOSSEN', datum: '2000-01-01' })
    modell.zusagen.unshift({ name: EIGENER_NAME, gast: false })
    modell.teams = teamsAus(modell)
    const welt = terminHandlers([modell])
    mockServer.use(...welt.handlers)
    const beiAbschluss = vi.fn()
    render(<Huelle beiAbschluss={beiAbschluss} />, { wrapper: QueryUmgebung })

    await userEvent.click(await screen.findByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    expect(await screen.findByTestId('huelle-anzeige')).toBeInTheDocument()
    await waitFor(() => expect(beiAbschluss).toHaveBeenCalledWith(false))
  })

  test('meldet bei ERGEBNIS_VORHANDEN den Abschluss auch nach dem Austausch', async () => {
    const modell = terminModell({ terminId: 102, status: 'ABGESCHLOSSEN', datum: '2000-01-01' })
    modell.zusagen.unshift({ name: EIGENER_NAME, gast: false })
    modell.teams = teamsAus(modell)
    const welt = terminHandlers([modell])
    mockServer.use(...welt.handlers)
    const beiAbschluss = vi.fn()
    render(<Huelle beiAbschluss={beiAbschluss} />, { wrapper: QueryUmgebung })
    await userEvent.click(await screen.findByTestId('ergebnis-sieger-b'))

    // Jemand war schneller: Der Server kennt das Ergebnis, die Ansicht noch nicht.
    modell.ergebnis = { sieger: 'U', deutlich: false, erfasstVon: 'Beispielspieler 07', erfasstAm: '2000-01-01T20:00:00Z', korrigiertAm: null, version: 1 }
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    expect(await screen.findByTestId('huelle-anzeige')).toBeInTheDocument()
    await waitFor(() => expect(beiAbschluss).toHaveBeenCalledWith(true))
  })
})
