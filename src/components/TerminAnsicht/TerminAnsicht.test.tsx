import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { beispielAdminSitzung, problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { EIGENER_NAME, detailsVon, terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import TerminAnsicht from './TerminAnsicht'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Wie vorher: Eine nachgebildete Welt mit einem Termin, gerendert in Router und Query-Umgebung. */
function rendern(
  teil: Partial<TerminModell> = {},
  eigenschaften: Partial<Parameters<typeof TerminAnsicht>[0]> = {},
) {
  const welt = terminHandlers([terminModell({ terminId: 102, ...teil })])
  mockServer.use(...welt.handlers)
  render(
    <MemoryRouter>
      <TerminAnsicht terminId={102} eingeklappt={false} {...eigenschaften} />
    </MemoryRouter>,
    { wrapper: QueryUmgebung },
  )
  return welt
}

/** Zusagen `anzahl` Mal, zuerst die eigene als Nummer `eigene` (1-basiert) oder keine. */
function zusagen(anzahl: number, eigenePosition?: number) {
  return Array.from({ length: anzahl }, (_, i) => ({
    name: i + 1 === eigenePosition ? EIGENER_NAME : `Beispielspieler ${String(i + 11)}`,
    gast: false,
  }))
}

describe('TerminAnsicht', () => {
  test('zeigt einen geplanten Termin mit Status, Balken, Liste und Leiste', async () => {
    rendern()
    expect(await screen.findByTestId('termin-karte')).toBeInTheDocument()
    expect(screen.getByTestId('termin-zusagestatus')).toHaveAttribute('data-zustand', 'offen')
    expect(screen.getByTestId('termin-balken')).toBeInTheDocument()
    expect(screen.getByTestId('teilnehmerliste')).toBeInTheDocument()
    expect(screen.getByTestId('aktionsleiste')).toBeInTheDocument()
  })

  test('fasst Karte, Rückmeldung und Balken in einem Kopfbereich zusammen, Liste und Leiste stehen außerhalb', async () => {
    rendern()
    const kopf = await screen.findByTestId('termin-kopf')
    expect(kopf).toContainElement(screen.getByTestId('termin-karte'))
    expect(kopf).toContainElement(screen.getByTestId('termin-zusagestatus'))
    expect(kopf).toContainElement(screen.getByTestId('termin-balken'))
    expect(kopf).not.toContainElement(screen.getByTestId('teilnehmerliste'))
    expect(kopf).not.toContainElement(screen.getByTestId('aktionsleiste'))
  })

  test('nennt ohne Warteschlange keine Platzzahl', async () => {
    rendern()
    await screen.findByTestId('termin-karte')
    expect(screen.queryByTestId('termin-wartesatz')).not.toBeInTheDocument()
    expect(screen.queryByText(/Plätzen belegt/)).not.toBeInTheDocument()
  })

  test('zeigt bei abgesagtem Termin den Kopfbereich ohne Balken', async () => {
    rendern({ status: 'ABGESAGT' })
    const kopf = await screen.findByTestId('termin-kopf')
    expect(kopf).toContainElement(screen.getByTestId('termin-karte'))
    expect(screen.queryByTestId('termin-balken')).not.toBeInTheDocument()
    expect(screen.queryByTestId('termin-wartesatz')).not.toBeInTheDocument()
  })

  test('zeigt waehrend des Ladens einen Spinner und keine Leiste', async () => {
    mockServer.use(
      http.get('*/termine/:terminId/lesen', async () => {
        await new Promise((r) => setTimeout(r, 100))
        return HttpResponse.json({})
      }),
    )
    render(
      <MemoryRouter>
        <TerminAnsicht terminId={102} eingeklappt={false} />
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )
    expect(screen.getByTestId('ladespinner')).toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('zeigt bei 404 einen Leerzustand mit Rueckweg zum Dashboard', async () => {
    mockServer.use(...terminHandlers([]).handlers)
    render(
      <MemoryRouter>
        <TerminAnsicht terminId={999} eingeklappt={false} />
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )
    expect(await screen.findByTestId('termin-nicht-gefunden')).toBeInTheDocument()
    expect(screen.getByTestId('termin-nicht-gefunden-zurueck')).toHaveAttribute('href', '/')
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('zeigt bei einem Serverfehler ohne Daten einen Fehlerzustand mit „Erneut versuchen“', async () => {
    mockServer.use(
      http.get('*/termine/:terminId/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')),
    )
    render(
      <MemoryRouter>
        <TerminAnsicht terminId={102} eingeklappt={false} />
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )
    expect(await screen.findByTestId('termin-fehler', undefined, { timeout: 8000 })).toBeInTheDocument()

    // „Erneut versuchen“ liest neu; der Server antwortet jetzt.
    mockServer.use(...terminHandlers([terminModell({ terminId: 102 })]).handlers)
    await userEvent.click(within(screen.getByTestId('termin-fehler')).getByRole('button'))
    expect(await screen.findByTestId('termin-karte')).toBeInTheDocument()
    expect(screen.queryByTestId('termin-fehler')).not.toBeInTheDocument()
  }, 15000)

  test('benennt bei begonnenem Termin den Grund und rendert die Leiste nicht', async () => {
    // Ein Termin in der Vergangenheit, aber noch GEPLANT: Der Server schliesst ihn erst spaeter.
    rendern({ datum: '2000-01-01' })
    expect(await screen.findByTestId('termin-begonnen')).toHaveTextContent(
      'Der Termin hat begonnen. Rückmeldungen sind nicht mehr möglich.',
    )
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
    expect(screen.getByTestId('teilnehmerliste')).toBeInTheDocument()
  })

  test('zeigt bei einem abgesagten Termin einen Satz, keine Liste und keine Leiste', async () => {
    rendern({ status: 'ABGESAGT', zusagen: [] })
    expect(await screen.findByTestId('termin-abgesagt')).toBeInTheDocument()
    expect(screen.queryByTestId('teilnehmerliste')).not.toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
    expect(screen.queryByTestId('termin-balken')).not.toBeInTheDocument()
  })

  test('zeigt bei einem abgeschlossenen Termin die Liste, aber keine Leiste und keinen Balken', async () => {
    rendern({ status: 'ABGESCHLOSSEN', datum: '2000-01-01', zusagen: zusagen(8) }, { verweise: true })
    expect(await screen.findByTestId('termin-abgeschlossen')).toBeInTheDocument()
    expect(screen.getByTestId('teilnehmerliste')).toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
    expect(screen.queryByTestId('termin-balken')).not.toBeInTheDocument()
    expect(screen.getByTestId('termin-ergebnis-link')).toHaveAttribute('href', '/ergebnisse/102')
    expect(screen.queryByTestId('termin-teams-link')).not.toBeInTheDocument()
  })

  test('zeigt die Verweise nur auf Verlangen und je nach Status', async () => {
    rendern({}, { verweise: true })
    expect(await screen.findByTestId('termin-teams-link')).toHaveAttribute('href', '/teams/102')
    expect(screen.queryByTestId('termin-ergebnis-link')).not.toBeInTheDocument()
  })

  test('zeigt ohne verweise keine Links', async () => {
    rendern()
    await screen.findByTestId('termin-karte')
    expect(screen.queryByTestId('termin-teams-link')).not.toBeInTheDocument()
  })

  test('nennt auf der Warteschlange den Platz im Status und die Höchstzahl im Kopfbereich', async () => {
    // 24 Zusagen bei Hoechstzahl 22, der eigene Eintrag an Position 23: Platz 1 der Warteschlange.
    rendern({ zusagen: zusagen(24, 23), eigene: true })
    expect(await screen.findByTestId('termin-zusagestatus')).toHaveTextContent(
      'Du hast zugesagt und stehst auf der Warteschlange (Platz 1).',
    )
    const wartesatz = screen.getByTestId('termin-wartesatz')
    expect(wartesatz).toHaveTextContent('Maximale Teilnehmerzahl von 22 erreicht, 2 auf der Warteschlange.')
    expect(screen.getByTestId('termin-kopf')).toContainElement(wartesatz)
  })

  test('liest die Mindestzahl vom Server und rechnet sie nicht nach', async () => {
    // 8 Zusagen bei Mindestzahl 6 ergaeben „erreicht“. Der Server sagt `false`
    // (A10: Er kennt die Regel, der Client nicht), und die Anzeige folgt ihm.
    const modell = terminModell({ terminId: 102, min: 6 })
    const details = detailsVon(modell)
    mockServer.use(
      http.get('*/termine/:terminId/lesen', () =>
        HttpResponse.json({ ...details, teilnehmerliste: { ...details.teilnehmerliste, mindestzahlErreicht: false } }),
      ),
    )
    render(
      <MemoryRouter>
        <TerminAnsicht terminId={102} eingeklappt={false} />
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )
    expect(await screen.findByTestId('termin-balken-text')).toHaveTextContent('8 von mindestens 6 Zusagen erreicht')
    expect(screen.getByTestId('termin-balken-fuellung')).toHaveAttribute('data-erreicht', 'false')
  })

  test('nennt bei erreichter Mindestzahl die Mindestanzahl als erreicht', async () => {
    rendern({ min: 6 })
    expect(await screen.findByTestId('termin-balken-text')).toHaveTextContent('8 Zusagen – Mindestanzahl von 6 erreicht')
    expect(screen.getByTestId('termin-balken-fuellung')).toHaveAttribute('data-erreicht', 'true')
  })

  test('traegt die Leiste als letztes Element der Ansicht, hinter weiteren Inhalten', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102 })])
    mockServer.use(...welt.handlers)
    render(
      <MemoryRouter>
        <TerminAnsicht terminId={102} eingeklappt>
          <p data-testid="weiterer-inhalt">Weitere Termine</p>
        </TerminAnsicht>
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )
    const ansicht = await screen.findByTestId('termin-ansicht')
    await screen.findByTestId('aktionsleiste')
    // Sticky haftet nur, wenn die Leiste das letzte Kind eines Behaelters ist, der den ganzen Inhalt umfasst.
    expect(ansicht.lastElementChild).toBe(screen.getByTestId('aktionsleiste'))
    expect(ansicht.firstElementChild).toContainElement(screen.getByTestId('weiterer-inhalt'))
    expect(screen.getByTestId('teilnehmerliste')).not.toHaveAttribute('open')
  })

  test('wechselt nach einer Zusage Status, Zahl und Leiste', async () => {
    rendern()
    await userEvent.click(await screen.findByTestId('rueckmeldung-zusagen'))
    await waitFor(() => expect(screen.getByTestId('termin-zusagestatus')).toHaveAttribute('data-zustand', 'zugesagt'))
    expect(screen.getByTestId('termin-balken-text')).toHaveTextContent('9 Zusagen – Mindestanzahl von 6 erreicht')
    expect(screen.getByTestId('rueckmeldung-absagen')).toBeInTheDocument()
    expect(screen.queryByTestId('rueckmeldung-zusagen')).not.toBeInTheDocument()
  })
})

describe('TerminAnsicht nurLesen (Admin, C7 E2)', () => {
  /** Der Admin liest den Termin; seine Sitzung hat die Rolle ADMIN. */
  function alsAdmin() {
    mockServer.use(http.get('*/auth/session/lesen', () => HttpResponse.json(beispielAdminSitzung)))
  }

  test('zeigt dem Admin keinen Zusagestatus, keine Leiste und keine Verweise, aber Karte, Balken und Liste', async () => {
    alsAdmin()
    rendern({}, { nurLesen: true, verweise: true })

    expect(await screen.findByTestId('termin-karte')).toBeInTheDocument()
    expect(screen.getByTestId('termin-balken')).toBeInTheDocument()
    expect(screen.getByTestId('teilnehmerliste')).toBeInTheDocument()
    // Der Admin kann nicht zusagen: ein „Anmeldung ausstehend“ waere falsch.
    expect(screen.queryByTestId('termin-zusagestatus')).not.toBeInTheDocument()
    expect(screen.queryByText(/Anmeldung ausstehend/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
    expect(screen.queryByTestId('termin-teams-link')).not.toBeInTheDocument()
  })

  test('blendet auch bei einem abgeschlossenen Termin den Ergebnisverweis aus', async () => {
    alsAdmin()
    rendern({ status: 'ABGESCHLOSSEN' }, { nurLesen: true, verweise: true })

    expect(await screen.findByTestId('termin-abgeschlossen')).toBeInTheDocument()
    expect(screen.queryByTestId('termin-ergebnis-link')).not.toBeInTheDocument()
  })

  test('zeigt Kinder und den Warteschlangensatz weiter an', async () => {
    alsAdmin()
    const welt = terminHandlers([terminModell({ terminId: 102, max: 6, zusagen: zusagen(8) })])
    mockServer.use(...welt.handlers)
    render(
      <MemoryRouter>
        <TerminAnsicht terminId={102} eingeklappt nurLesen>
          <p data-testid="kind">Termin verwalten</p>
        </TerminAnsicht>
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )

    // Die Kinder stehen schon waehrend des Ladens da; der Satz kommt mit den Daten.
    expect(screen.getByTestId('kind')).toBeInTheDocument()
    expect(await screen.findByTestId('termin-wartesatz')).toHaveTextContent(
      'Maximale Teilnehmerzahl von 6 erreicht, 2 auf der Warteschlange.',
    )
  })

  test('ohne nurLesen bleibt das Standardverhalten: Zusagestatus, Leiste und Verweis', async () => {
    rendern({}, { verweise: true })

    expect(await screen.findByTestId('termin-zusagestatus')).toBeInTheDocument()
    expect(screen.getByTestId('aktionsleiste')).toBeInTheDocument()
    expect(screen.getByTestId('termin-teams-link')).toBeInTheDocument()
  })
})

describe('TerminAnsicht ohneAktualisierung (Verwaltung, C7 4.1)', () => {
  afterEach(() => vi.useRealTimers())

  test('ruft nach 60 Sekunden Fake-Zeit nicht ein zweites Mal ab, der Kopf bleibt gesetzt', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'], shouldAdvanceTime: true })
    const welt = rendern({}, { ohneAktualisierung: true, nurLesen: true })
    expect(await screen.findByTestId('termin-karte')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(60_000)

    expect(welt.protokoll.detailabrufe).toEqual(['true'])
  })

  test('mit Aktualisierung (Vorgabe) liest er im Takt weiter', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'], shouldAdvanceTime: true })
    const welt = rendern({}, { nurLesen: true })
    expect(await screen.findByTestId('termin-karte')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(45_000)

    expect(welt.protokoll.detailabrufe.length).toBeGreaterThanOrEqual(2)
  })
})
