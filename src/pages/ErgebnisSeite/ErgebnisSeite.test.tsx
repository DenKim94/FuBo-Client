import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { beispielAdminSitzung, beispielSitzung } from '@/test/mocks/handlers'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import {
  beispielErgebnis,
  EIGENER_NAME,
  teamsAus,
  terminHandlers,
  terminModell,
  type TerminModell,
} from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import { datumLang, heuteIso } from '@/api/termine/terminZeit'
import ErgebnisSeite from './ErgebnisSeite'

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
      { path: '/ergebnisse', element: <ErgebnisSeite /> },
      { path: '/ergebnisse/:terminId', element: <ErgebnisSeite /> },
      { path: '*', element: <p>Sonst</p> },
    ],
    { initialEntries: [pfad] },
  )
  render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
  return welt
}

/** Das Datum vor `n` Tagen: Der Hub liest nur das Fenster der letzten Tage (E14), feste Daten fielen heraus. */
function vorTagen(n: number): string {
  return heuteIso(new Date(Date.now() - n * 86_400_000))
}

/** Ein abgeschlossener Termin mit eigener Teilnahme; mit Einteilung, wenn nichts anderes gesagt ist. */
function abgeschlossen(teil: Partial<TerminModell> & { terminId: number }, mitTeams = true): TerminModell {
  const modell = terminModell({ status: 'ABGESCHLOSSEN', datum: '2000-01-01', ...teil })
  // Die eigene Sitzung spielte mit und steht damit in der Einteilung: Nur dann darf sie eintragen (22.10.2026).
  if (!teil.zusagen) modell.zusagen = [{ name: EIGENER_NAME, gast: false }, ...modell.zusagen]
  if (mitTeams && !modell.teams) modell.teams = teamsAus(modell, 'Beispielspieler 01')
  return modell
}

describe('ErgebnisSeite: Termin bestimmen', () => {
  test('nimmt auf dem Hub den zuletzt abgeschlossenen Termin', async () => {
    rendern(
      '/ergebnisse',
      abgeschlossen({ terminId: 1, datum: vorTagen(14) }),
      abgeschlossen({ terminId: 2, datum: vorTagen(7) }),
      terminModell({ terminId: 3, datum: '2099-01-06' }),
    )
    expect(await screen.findByTestId('ergebnis-formular')).toBeInTheDocument()
    expect(screen.getByTestId('termin-karte')).toHaveTextContent(datumLang(vorTagen(7)))
  })

  test('zeigt mit Parameter genau diesen Termin', async () => {
    rendern(
      '/ergebnisse/1',
      abgeschlossen({ terminId: 1, datum: '2000-01-05' }),
      abgeschlossen({ terminId: 2, datum: '2000-01-12' }),
    )
    expect(await screen.findByTestId('ergebnis-formular')).toBeInTheDocument()
    expect(screen.getByTestId('termin-karte')).toHaveTextContent(datumLang('2000-01-05'))
  })

  test('zeigt ohne abgeschlossenen Termin den Leerzustand und behaelt die Bilanz', async () => {
    rendern('/ergebnisse', terminModell({ terminId: 3, datum: '2099-01-06' }))
    expect(await screen.findByTestId('ergebnisse-leer')).toHaveTextContent('Noch kein abgeschlossener Termin')
    expect(await screen.findByTestId('bilanz-karte')).toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test.each(['abc', '0', '-1'])('zeigt bei der ungueltigen Adresse %s „nicht gefunden“ ohne Abruf', async (id) => {
    const welt = rendern(`/ergebnisse/${id}`, abgeschlossen({ terminId: 2 }))
    expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(welt.protokoll.detailabrufe).toHaveLength(0)
    expect(welt.protokoll.listenabrufe).toHaveLength(0)
  })

  test('zeigt bei einem unbekannten Termin den Leerzustand mit Rueckweg', async () => {
    rendern('/ergebnisse/999', abgeschlossen({ terminId: 2 }))
    expect(await screen.findByTestId('ergebnis-nicht-gefunden')).toBeInTheDocument()
    expect(screen.getByTestId('ergebnis-nicht-gefunden-zurueck')).toHaveAttribute('href', '/')
  })

  test('zeigt bei einem Serverfehler auf dem Hub einen Fehlerzustand', async () => {
    mockServer.use(http.get('*/termine/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    const router = createMemoryRouter([{ path: '/ergebnisse', element: <ErgebnisSeite /> }], {
      initialEntries: ['/ergebnisse'],
    })
    render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
    expect(await screen.findByTestId('ergebnisse-fehler-zustand', undefined, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.queryByTestId('ergebnisse-leer')).not.toBeInTheDocument()
  }, 15000)
})

describe('ErgebnisSeite: Zustandsmatrix', () => {
  test('ABGESCHLOSSEN mit Ergebnis zeigt die Anzeige, kein Formular', async () => {
    rendern('/ergebnisse/102', abgeschlossen({ terminId: 102, ergebnis: beispielErgebnis }))
    expect(await screen.findByTestId('ergebnis-anzeige')).toBeInTheDocument()
    expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent('Team A hat deutlich gewonnen.')
    expect(screen.queryByTestId('ergebnis-formular')).not.toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
    // Die Einteilung bleibt als Zusammenhang sichtbar.
    expect(screen.getByTestId('teams-anzeige')).toBeInTheDocument()
  })

  test('ABGESCHLOSSEN mit Einteilung ohne Ergebnis zeigt das Formular', async () => {
    rendern('/ergebnisse/102', abgeschlossen({ terminId: 102 }))
    expect(await screen.findByTestId('ergebnis-formular')).toBeInTheDocument()
    expect(screen.getByTestId('teams-anzeige')).toBeInTheDocument()
    expect(screen.queryByTestId('ergebnis-anzeige')).not.toBeInTheDocument()
  })

  test('ABGESCHLOSSEN ohne Einteilung und ohne Ergebnis sagt, warum nichts einzutragen ist', async () => {
    rendern('/ergebnisse/102', abgeschlossen({ terminId: 102 }, false))
    expect(await screen.findByTestId('ergebnis-ohne-einteilung')).toHaveTextContent(
      'Für diesen Termin wurden keine Teams eingeteilt, ein Ergebnis lässt sich daher nicht eintragen.',
    )
    expect(screen.queryByTestId('ergebnis-formular')).not.toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('GEPLANT nennt den Zeitpunkt, ab dem das Ergebnis geht, ohne Formular', async () => {
    rendern('/ergebnisse/102', terminModell({ terminId: 102 }))
    expect(await screen.findByTestId('ergebnis-noch-nicht')).toHaveTextContent(
      'Das Ergebnis lässt sich eintragen, sobald der Termin abgeschlossen ist.',
    )
    expect(screen.queryByTestId('ergebnis-formular')).not.toBeInTheDocument()
  })

  test('ABGESAGT sagt, dass der Termin abgesagt wurde, ohne Formular', async () => {
    rendern('/ergebnisse/102', terminModell({ terminId: 102, status: 'ABGESAGT', zusagen: [] }))
    expect(await screen.findByTestId('ergebnis-abgesagt')).toHaveTextContent('Dieser Termin wurde abgesagt.')
    expect(screen.queryByTestId('ergebnis-formular')).not.toBeInTheDocument()
  })
})

describe('ErgebnisSeite: Bilanz', () => {
  test('zeigt die Bilanz oberhalb der Termin-Karte', async () => {
    rendern('/ergebnisse/102', abgeschlossen({ terminId: 102, ergebnis: beispielErgebnis }))
    const bilanz = await screen.findByTestId('bilanz-karte')
    const karte = await screen.findByTestId('termin-karte')
    expect(bilanz.compareDocumentPosition(karte) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('laesst die Bilanz fuer einen Gast weg und ruft sie nicht ab', async () => {
    mockServer.use(http.get('*/auth/session/lesen', () => HttpResponse.json({ ...beispielSitzung, rolle: 'GAST' })))
    const welt = rendern('/ergebnisse/102', abgeschlossen({ terminId: 102, ergebnis: beispielErgebnis }))
    expect(await screen.findByTestId('ergebnis-anzeige')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('bilanz-karte')).not.toBeInTheDocument())
    expect(welt.protokoll.bilanzabrufe).toHaveLength(0)
  })
})

describe('ErgebnisSeite: nur Eingeteilte tragen ein', () => {
  test('wer nicht eingeteilt war (etwa auf der Warteschlange), sieht statt des Formulars einen Hinweis', async () => {
    // Die eigene Sitzung steht nicht in der Einteilung (die Zusagen enthalten sie nicht).
    const modell = abgeschlossen({ terminId: 4, zusagen: [{ name: 'Beispielspieler 11', gast: false }, { name: 'Beispielspieler 12', gast: false }] })
    rendern('/ergebnisse/4', modell)

    expect(await screen.findByTestId('ergebnis-nicht-eingeteilt')).toHaveTextContent(
      'Ein Ergebnis eintragen darf nur, wer in diesem Termin eingeteilt war.',
    )
    expect(screen.queryByTestId('ergebnis-formular')).not.toBeInTheDocument()
    // Die Einteilung bleibt sichtbar.
    expect(screen.getByTestId('teams-anzeige')).toBeInTheDocument()
  })

  test('der Admin darf auch ohne Einteilung eintragen (wie am Server)', async () => {
    mockServer.use(http.get('*/auth/session/lesen', () => HttpResponse.json(beispielAdminSitzung)))
    const modell = {
      ...abgeschlossen({ terminId: 4, zusagen: [{ name: 'Beispielspieler 11', gast: false }, { name: 'Beispielspieler 12', gast: false }] }),
      adminSitzung: true,
    }
    rendern('/ergebnisse/4', modell)

    expect(await screen.findByTestId('ergebnis-formular')).toBeInTheDocument()
    expect(screen.queryByTestId('ergebnis-nicht-eingeteilt')).not.toBeInTheDocument()
  })
})

describe('ErgebnisSeite: Eintragen', () => {
  test('traegt ein, zeigt die Anzeige mit Hinweis, setzt den Fokus und aktualisiert die Bilanz', async () => {
    const welt = rendern('/ergebnisse/102', abgeschlossen({ terminId: 102 }))
    await userEvent.click(await screen.findByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    const titel = await screen.findByTestId('ergebnis-anzeige-titel')
    await waitFor(() => expect(titel).toHaveFocus())
    expect(screen.getByTestId('ergebnis-erfasst')).toHaveTextContent('Das Ergebnis wurde eingetragen.')
    expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent(/^Team A hat gewonnen\.$/)
    expect(screen.queryByTestId('ergebnis-formular')).not.toBeInTheDocument()
    expect(welt.protokoll.erfassungen).toEqual([{ terminId: 102, sieger: 'A', deutlich: false, kopf: null }])
    // Die Bilanz wurde neu gelesen und zaehlt den Sieg (eigener Eintrag in Team A oder B, je nach Mock-Einteilung).
    await waitFor(() => expect(welt.protokoll.bilanzabrufe.length).toBeGreaterThanOrEqual(2))
  })

  test('zeigt bei ERGEBNIS_VORHANDEN den Hinweis und das Ergebnis der anderen Person', async () => {
    const modell = abgeschlossen({ terminId: 102 })
    const welt = rendern('/ergebnisse/102', modell)
    await userEvent.click(await screen.findByTestId('ergebnis-sieger-b'))

    // Zwischen Anzeige und Absenden war jemand schneller.
    modell.ergebnis = { ...beispielErgebnis, sieger: 'U', deutlich: false, erfasstVon: 'Beispielspieler 07' }
    await userEvent.click(screen.getByTestId('ergebnis-absenden'))
    await userEvent.click(screen.getByTestId('ergebnis-bestaetigen'))

    expect(await screen.findByTestId('ergebnis-vorhanden')).toHaveTextContent(
      'Das Ergebnis war bereits erfasst; es gilt der erste Eintrag.',
    )
    expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent(/^Unentschieden\.$/)
    expect(screen.getByTestId('ergebnis-anzeige-erfasst')).toHaveTextContent('Beispielspieler 07')
    expect(screen.queryByTestId('ergebnis-fehler')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('ergebnis-anzeige-titel')).toHaveFocus())
    expect(welt.protokoll.erfassungen).toHaveLength(1)
  })

  test('traegt das Formular als letztes Element der Seite', async () => {
    rendern('/ergebnisse/102', abgeschlossen({ terminId: 102 }))
    const leiste = await screen.findByTestId('aktionsleiste')
    expect(screen.getByTestId('ergebnisse-seite').lastElementChild).toBe(leiste)
  })
})
