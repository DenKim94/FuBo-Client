import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/problem'
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
  test('zeigt einen geplanten Termin mit Status, Balken, Platzsatz, Liste und Leiste', async () => {
    rendern()
    expect(await screen.findByTestId('termin-karte')).toBeInTheDocument()
    expect(screen.getByTestId('termin-zusagestatus')).toHaveAttribute('data-zustand', 'offen')
    expect(screen.getByTestId('termin-balken')).toBeInTheDocument()
    expect(screen.getByTestId('termin-platzsatz')).toHaveTextContent('8 von 22 Plätzen belegt.')
    expect(screen.getByTestId('teilnehmerliste')).toBeInTheDocument()
    expect(screen.getByTestId('aktionsleiste')).toBeInTheDocument()
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

  test('nennt auf der Warteschlange den Platz im Status und im Platzsatz', async () => {
    // 24 Zusagen bei Hoechstzahl 22, der eigene Eintrag an Position 23: Platz 1 der Warteschlange.
    rendern({ zusagen: zusagen(24, 23), eigene: true })
    expect(await screen.findByTestId('termin-zusagestatus')).toHaveTextContent(
      'Du hast zugesagt und stehst auf der Warteschlange (Platz 1).',
    )
    expect(screen.getByTestId('termin-platzsatz')).toHaveTextContent('Alle 22 Plätze belegt, 2 auf der Warteschlange.')
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
    expect(await screen.findByTestId('termin-balken-text')).toHaveTextContent('Mindestanzahl noch nicht erreicht')
    expect(screen.getByTestId('termin-balken-fuellung')).toHaveAttribute('data-erreicht', 'false')
  })

  test('zeigt bei erreichter Mindestzahl keinen Zusatz', async () => {
    rendern({ min: 6 })
    expect(await screen.findByTestId('termin-balken-text')).not.toHaveTextContent('Mindestanzahl')
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
    expect(screen.getByTestId('termin-platzsatz')).toHaveTextContent('9 von 22 Plätzen belegt.')
    expect(screen.getByTestId('rueckmeldung-absagen')).toBeInTheDocument()
    expect(screen.queryByTestId('rueckmeldung-zusagen')).not.toBeInTheDocument()
  })
})
