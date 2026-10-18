import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { schluessel } from '@/api/common/schluessel'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { EIGENER_NAME, teamsAus, terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import TeamsSeite from './TeamsSeite'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Rendert die Seite unter `pfad`; beide Routen (Hub und Termin) zeigen dieselbe Seite. */
function rendern(pfad: string, ...modelle: TerminModell[]) {
  const welt = terminHandlers(modelle)
  mockServer.use(...welt.handlers)
  const router = createMemoryRouter(
    [
      { path: '/teams', element: <TeamsSeite /> },
      { path: '/teams/:terminId', element: <TeamsSeite /> },
      { path: '*', element: <p>Sonst</p> },
    ],
    { initialEntries: [pfad] },
  )
  render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
  return welt
}

/** Ein Termin mit bereits erzeugter Einteilung (Version gleich, also aktuell). */
function mitEinteilung(teil: Partial<TerminModell> & { terminId: number }): TerminModell {
  const modell = terminModell(teil)
  return { ...modell, teams: teamsAus(modell, 'Beispielspieler 01'), teamsVersion: modell.teilnehmerVersion }
}

describe('TeamsSeite: Termin bestimmen', () => {
  test('zeigt ohne geplanten Termin den Leerzustand', async () => {
    rendern('/teams')
    expect(await screen.findByTestId('teams-leer')).toHaveTextContent('Kein Termin geplant')
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('nimmt auf dem Hub den ersten geplanten Termin und uebergeht abgesagte', async () => {
    rendern(
      '/teams',
      terminModell({ terminId: 1, datum: '2099-01-06', status: 'ABGESAGT', zusagen: [] }),
      terminModell({ terminId: 2, datum: '2099-01-13' }),
    )
    expect(await screen.findByTestId('teams-nicht-generiert')).toBeInTheDocument()
    expect(screen.getByTestId('termin-karte')).toHaveTextContent('13. Januar')
  })

  test('zeigt mit Parameter genau diesen Termin', async () => {
    rendern(
      '/teams/3',
      terminModell({ terminId: 2, datum: '2099-01-13' }),
      terminModell({ terminId: 3, datum: '2099-01-20' }),
    )
    expect(await screen.findByTestId('termin-karte')).toHaveTextContent('20. Januar')
  })

  test.each(['abc', '0', '-1'])('zeigt bei der ungueltigen Adresse %s „nicht gefunden“ ohne Abruf', async (id) => {
    const welt = rendern(`/teams/${id}`, terminModell({ terminId: 2 }))
    expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(welt.protokoll.detailabrufe).toHaveLength(0)
    expect(welt.protokoll.listenabrufe).toHaveLength(0)
  })

  test('zeigt bei einem unbekannten Termin den Leerzustand mit Rueckweg', async () => {
    rendern('/teams/999', terminModell({ terminId: 2 }))
    expect(await screen.findByTestId('teams-nicht-gefunden')).toBeInTheDocument()
    expect(screen.getByTestId('teams-nicht-gefunden-zurueck')).toHaveAttribute('href', '/')
  })

  test('zeigt bei einem Serverfehler auf dem Hub einen Fehlerzustand', async () => {
    mockServer.use(http.get('*/termine/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    const router = createMemoryRouter([{ path: '/teams', element: <TeamsSeite /> }], { initialEntries: ['/teams'] })
    render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
    expect(await screen.findByTestId('teams-fehler-zustand', undefined, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.queryByTestId('teams-leer')).not.toBeInTheDocument()
  }, 15000)
})

describe('TeamsSeite: Zustaende der Einteilung', () => {
  test('behandelt teams = null als „Noch keine Einteilung“ und nicht als leere Liste', async () => {
    rendern('/teams/102', terminModell({ terminId: 102 }))
    const leer = await screen.findByTestId('teams-nicht-generiert')
    expect(leer).toHaveTextContent('Noch keine Einteilung')
    expect(leer).toHaveTextContent('Sobald jemand die Teams generiert, erscheinen sie hier.')
    expect(screen.queryByTestId('teams-anzeige')).not.toBeInTheDocument()
    expect(screen.getByTestId('teams-generieren')).toHaveTextContent('Teams generieren')
  })

  test('zeigt eine vorhandene Einteilung samt „(du)“ und Auswechselspieler', async () => {
    rendern(
      '/teams/102',
      mitEinteilung({
        terminId: 102,
        eigene: true,
        zusagen: [
          { name: EIGENER_NAME, gast: false },
          { name: 'Beispielspieler 11', gast: false },
          { name: 'Beispielspieler 12', gast: false },
        ],
      }),
    )
    expect(await screen.findByTestId('teams-anzeige')).toBeInTheDocument()
    expect(screen.getByText(`${EIGENER_NAME} (du)`)).toBeInTheDocument()
    expect(screen.getAllByTestId('teams-anzeige-auswechselspieler')).toHaveLength(1)
    expect(screen.getByTestId('teams-generieren')).toHaveTextContent('Teams neu generieren')
  })

  test('zeigt eine veraltete Einteilung samt Hinweis und dem Weg zur Neugenerierung', async () => {
    const modell = mitEinteilung({ terminId: 102 })
    modell.teilnehmerVersion += 1 // eine Aenderung nach dem Lauf
    rendern('/teams/102', modell)

    expect(await screen.findByTestId('teams-anzeige-veraltet')).toHaveTextContent('Du kannst die Teams neu generieren.')
    // Verstecken waere falsch: Die Einteilung bleibt sichtbar.
    expect(screen.getByTestId('teams-anzeige-a')).toBeInTheDocument()
    expect(screen.getByTestId('teams-generieren')).toBeInTheDocument()
  })

  test('zeigt bei abgesagtem Termin Hinweis und weder Einteilung noch Leiste', async () => {
    rendern('/teams/102', terminModell({ terminId: 102, status: 'ABGESAGT', zusagen: [] }))
    expect(await screen.findByTestId('teams-abgesagt')).toBeInTheDocument()
    expect(screen.queryByTestId('teams-nicht-generiert')).not.toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('zeigt bei abgeschlossenem Termin ohne Einteilung den Grund und keine Leiste', async () => {
    rendern('/teams/102', terminModell({ terminId: 102, status: 'ABGESCHLOSSEN', datum: '2000-01-01' }))
    expect(await screen.findByTestId('teams-nicht-generiert')).toHaveTextContent(
      'Für diesen Termin wurde keine Einteilung erzeugt.',
    )
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('zeigt bei begonnenem Termin die Einteilung und „Die Einteilung steht fest.“ ohne Aktion', async () => {
    // Datum in der Vergangenheit, Status noch GEPLANT: Der Server schliesst ihn erst spaeter.
    rendern('/teams/102', mitEinteilung({ terminId: 102, datum: '2000-01-01' }))
    expect(await screen.findByTestId('teams-fixiert')).toBeInTheDocument()
    expect(screen.getByTestId('teams-anzeige')).toBeInTheDocument()
    expect(screen.queryByTestId('teams-generieren')).not.toBeInTheDocument()
  })

  test('sperrt ohne Mindestzahl die Aktion mit Grund; der Server entscheidet ueber die Zahl', async () => {
    const welt = rendern('/teams/102', terminModell({ terminId: 102, min: 20 }))
    const knopf = await screen.findByTestId('teams-generieren')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('teams-grund')).toHaveTextContent('Mindestens 20 Zusagen sind erforderlich.')

    await userEvent.click(knopf)
    expect(welt.protokoll.generierungen).toHaveLength(0)
  })

  test('liest die Mindestzahl vom Server und rechnet sie nicht nach', async () => {
    // 8 Zusagen bei Mindestzahl 6 waeren „erreicht“; der Server sagt nein, die Seite folgt ihm.
    const modell = terminModell({ terminId: 102, min: 6 })
    mockServer.use(
      http.get('*/termine/:terminId/lesen', async ({ params }) => {
        const { detailsVon } = await import('@/test/mocks/termine')
        const d = detailsVon(modell)
        return params.terminId === '102'
          ? HttpResponse.json({ ...d, teilnehmerliste: { ...d.teilnehmerliste, mindestzahlErreicht: false } })
          : problem(404, 'INHALT_NICHT_GEFUNDEN', 'Nicht gefunden.')
      }),
    )
    const router = createMemoryRouter([{ path: '/teams/:terminId', element: <TeamsSeite /> }], {
      initialEntries: ['/teams/102'],
    })
    render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
    expect(await screen.findByTestId('teams-generieren')).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('TeamsSeite: Generieren', () => {
  test('generiert, zeigt die Einteilung und setzt den Fokus auf deren Ueberschrift', async () => {
    const welt = rendern('/teams/102', terminModell({ terminId: 102 }))
    await userEvent.click(await screen.findByTestId('teams-generieren'))

    const kopf = await screen.findByTestId('teams-anzeige-kopf')
    await waitFor(() => expect(kopf).toHaveFocus())
    expect(screen.getByTestId('teams-erfolg')).toHaveTextContent('Teams wurden generiert.')
    expect(screen.queryByTestId('teams-nicht-generiert')).not.toBeInTheDocument()
    expect(screen.getByTestId('teams-generieren')).toHaveTextContent('Teams neu generieren')
    expect(welt.protokoll.generierungen).toEqual([{ terminId: 102, kopf: null }])
  })

  test('fragt beim Ersetzen einer aktuellen Einteilung nach und ersetzt sie nach Bestaetigung', async () => {
    const welt = rendern('/teams/102', mitEinteilung({ terminId: 102 }))
    await userEvent.click(await screen.findByTestId('teams-generieren'))
    expect(screen.getByTestId('teams-ersetzen-dialog')).toHaveAttribute('open')
    expect(welt.protokoll.generierungen).toHaveLength(0)

    await userEvent.click(screen.getByTestId('teams-ersetzen-bestaetigen'))
    await waitFor(() => expect(welt.protokoll.generierungen).toHaveLength(1))
    await waitFor(() => expect(screen.getByTestId('teams-anzeige-kopf')).toHaveFocus())
  })

  test('sperrt nach KONTINGENT_ERSCHOEPFT bis sich die Teilnehmerliste aendert, ohne Fehlermeldung', async () => {
    const welt = rendern('/teams/102', terminModell({ terminId: 102, kontingent: 0 }))
    await userEvent.click(await screen.findByTestId('teams-generieren'))

    expect(await screen.findByTestId('teams-grund')).toHaveTextContent('Das Kontingent für diese Teilnehmerliste ist aufgebraucht.')
    expect(screen.getByTestId('teams-generieren')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByTestId('teams-fehler')).not.toBeInTheDocument()

    // Ein weiterer Tipp tut nichts, bis die Liste sich aendert.
    await userEvent.click(screen.getByTestId('teams-generieren'))
    expect(welt.protokoll.generierungen).toHaveLength(1)

    // Jemand sagt zu: neue Teilnehmerversion, die Sperre faellt.
    welt.modelle[0].teilnehmerVersion += 1
    welt.modelle[0].zusagen.push({ name: 'Beispielspieler 30', gast: false })
    await queryClient.invalidateQueries({ queryKey: schluessel.terminAlle })
    await waitFor(() => expect(screen.queryByTestId('teams-grund')).not.toBeInTheDocument())
    expect(screen.getByTestId('teams-generieren')).not.toHaveAttribute('aria-disabled')
  })

  test('zeigt einen anderen Fehler als Meldung und behaelt die Aktion', async () => {
    const welt = rendern('/teams/102', terminModell({ terminId: 102 }))
    mockServer.use(
      http.post('*/teams/generieren', () =>
        problem(409, 'SKILLWERTE_UNVOLLSTAENDIG', 'Für einzelne Spieler fehlen Skillwerte (Kategorie Tempo).'),
      ),
    )
    await userEvent.click(await screen.findByTestId('teams-generieren'))

    expect(await screen.findByTestId('teams-fehler')).toHaveTextContent('Skillwerte')
    expect(screen.getByTestId('teams-generieren')).not.toHaveAttribute('aria-disabled')
    expect(welt.protokoll.generierungen).toHaveLength(0)
  })

  test('traegt die Leiste als letztes Element der Seite', async () => {
    rendern('/teams/102', mitEinteilung({ terminId: 102 }))
    const leiste = await screen.findByTestId('aktionsleiste')
    expect(screen.getByTestId('teams-seite').lastElementChild).toBe(leiste)
  })
})
