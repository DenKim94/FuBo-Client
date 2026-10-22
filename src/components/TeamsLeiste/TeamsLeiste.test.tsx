import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import TeamsLeiste from './TeamsLeiste'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

type Eigenschaften = Parameters<typeof TeamsLeiste>[0]

/** Rendert die Leiste gegen eine nachgebildete Welt; Vorgabe: bedienbar, keine Einteilung. */
function rendern(teil: Partial<Eigenschaften> = {}, modellTeil: Parameters<typeof terminModell>[0] = { terminId: 102, eigene: true }) {
  const welt = terminHandlers([terminModell(modellTeil)])
  mockServer.use(...welt.handlers)
  const beiErfolg = vi.fn()
  const beiKontingentErschoepft = vi.fn()
  render(
    <TeamsLeiste
      terminId={102}
      vorhanden={false}
      veraltet={false}
      berechtigt
      mindestzahlErreicht
      minTeilnehmer={6}
      begonnen={false}
      gesperrtDurchKontingent={false}
      beiErfolg={beiErfolg}
      beiKontingentErschoepft={beiKontingentErschoepft}
      {...teil}
    />,
    { wrapper: QueryUmgebung },
  )
  return { welt, beiErfolg, beiKontingentErschoepft }
}

describe('TeamsLeiste', () => {
  test('bietet ohne Einteilung „Teams generieren“ an, mit Einteilung „Teams neu generieren“', () => {
    const { unmount } = render(
      <QueryUmgebung>
        <TeamsLeiste
          terminId={102}
          vorhanden={false}
          veraltet={false}
          berechtigt
          mindestzahlErreicht
          minTeilnehmer={6}
          begonnen={false}
          gesperrtDurchKontingent={false}
          beiErfolg={() => {}}
          beiKontingentErschoepft={() => {}}
        />
      </QueryUmgebung>,
    )
    expect(screen.getByTestId('teams-generieren')).toHaveTextContent('Teams generieren')
    unmount()
    rendern({ vorhanden: true, veraltet: true })
    expect(screen.getByTestId('teams-generieren')).toHaveTextContent('Teams neu generieren')
  })

  test('generiert ohne Einteilung sofort, ohne Hintergrundkopf, und meldet den Erfolg', async () => {
    const { welt, beiErfolg } = rendern()
    await userEvent.click(screen.getByTestId('teams-generieren'))

    await waitFor(() => expect(beiErfolg).toHaveBeenCalledTimes(1))
    expect(welt.protokoll.generierungen).toEqual([{ terminId: 102, kopf: null }])
    expect(screen.getByTestId('teams-erfolg')).toHaveTextContent('Teams wurden generiert.')
    expect(screen.getByTestId('teams-erfolg')).toHaveAttribute('role', 'status')
  })

  test('fragt vor dem Ersetzen einer aktuellen Einteilung nach', async () => {
    const { welt } = rendern({ vorhanden: true, veraltet: false, erzeugtVon: 'Beispielspieler 01' })
    await userEvent.click(screen.getByTestId('teams-generieren'))

    // Noch kein Lauf: Die Rueckfrage steht dazwischen.
    expect(welt.protokoll.generierungen).toHaveLength(0)
    expect(screen.getByTestId('teams-ersetzen-dialog')).toHaveAttribute('open')
    expect(screen.getByTestId('teams-ersetzen-dialog')).toHaveTextContent(
      'Die aktuelle Einteilung von Beispielspieler 01 wird ersetzt.',
    )

    await userEvent.click(screen.getByTestId('teams-ersetzen-bestaetigen'))
    await waitFor(() => expect(welt.protokoll.generierungen).toHaveLength(1))
  })

  test('verzichtet auf den Lauf, wenn die Rueckfrage abgebrochen wird', async () => {
    const { welt } = rendern({ vorhanden: true, veraltet: false, erzeugtVon: 'Beispielspieler 01' })
    await userEvent.click(screen.getByTestId('teams-generieren'))
    await userEvent.click(screen.getByTestId('teams-ersetzen-abbrechen'))

    expect(screen.getByTestId('teams-ersetzen-dialog')).not.toHaveAttribute('open')
    expect(welt.protokoll.generierungen).toHaveLength(0)
  })

  test('ersetzt eine veraltete Einteilung ohne Rueckfrage', async () => {
    const { welt } = rendern({ vorhanden: true, veraltet: true, erzeugtVon: 'Beispielspieler 01' })
    await userEvent.click(screen.getByTestId('teams-generieren'))

    await waitFor(() => expect(welt.protokoll.generierungen).toHaveLength(1))
    expect(screen.getByTestId('teams-ersetzen-dialog')).not.toHaveAttribute('open')
  })

  test('wer nicht mitspielt (abgesagt, nicht gemeldet, Warteschlange), kann nicht generieren und erfährt den Grund', async () => {
    const { welt } = rendern({ berechtigt: false })

    const knopf = screen.getByTestId('teams-generieren')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('teams-grund')).toHaveTextContent('Nur Teilnehmer des Termins dürfen den Team-Generator nutzen.')
    expect(knopf).toHaveAccessibleDescription('Nur Teilnehmer des Termins dürfen den Team-Generator nutzen.')

    await userEvent.click(knopf)
    expect(welt.protokoll.generierungen).toHaveLength(0)
  })

  test('der fehlende Teilnehmerstatus geht den anderen Gründen vor', () => {
    rendern({ berechtigt: false, mindestzahlErreicht: false, gesperrtDurchKontingent: true })

    expect(screen.getByTestId('teams-grund')).toHaveTextContent('Nur Teilnehmer des Termins')
  })

  test('sperrt ohne Mindestzahl mit Grund aus Server-Werten und tut beim Tipp nichts', async () => {
    const { welt } = rendern({ mindestzahlErreicht: false, minTeilnehmer: 6 })
    const knopf = screen.getByTestId('teams-generieren')

    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    // Nicht `disabled`: Der Fokus bleibt erreichbar, der Grund wird vorgelesen.
    expect(knopf).not.toBeDisabled()
    expect(screen.getByTestId('teams-grund')).toHaveTextContent('Mindestens 6 Zusagen sind erforderlich.')
    expect(knopf).toHaveAttribute('aria-describedby', screen.getByTestId('teams-grund').id)

    await userEvent.click(knopf)
    expect(welt.protokoll.generierungen).toHaveLength(0)
  })

  test('sperrt nach erschoepftem Kontingent mit Grund und Weg zur Freigabe', async () => {
    const { welt } = rendern({ gesperrtDurchKontingent: true })

    expect(screen.getByTestId('teams-generieren')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('teams-grund')).toHaveTextContent(
      'Das Kontingent für diese Teilnehmerliste ist aufgebraucht. Eine neue Zusage setzt es zurück.',
    )
    await userEvent.click(screen.getByTestId('teams-generieren'))
    expect(welt.protokoll.generierungen).toHaveLength(0)
  })

  test('nennt zuerst die fehlende Mindestzahl, wenn beides zutrifft', () => {
    rendern({ mindestzahlErreicht: false, gesperrtDurchKontingent: true })
    expect(screen.getByTestId('teams-grund')).toHaveTextContent('Zusagen sind erforderlich')
  })

  test('zeigt nach begonnenem Termin nur „Die Einteilung steht fest.“', () => {
    rendern({ begonnen: true, vorhanden: true })
    expect(screen.getByTestId('teams-fixiert')).toHaveTextContent('Die Einteilung steht fest.')
    expect(screen.queryByTestId('teams-generieren')).not.toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('behandelt KONTINGENT_ERSCHOEPFT als gesperrten Zustand und nicht als Fehlermeldung', async () => {
    const { beiKontingentErschoepft } = rendern({}, { terminId: 102, eigene: true, kontingent: 0 })
    await userEvent.click(screen.getByTestId('teams-generieren'))

    await waitFor(() => expect(beiKontingentErschoepft).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('teams-fehler')).not.toBeInTheDocument()
  })

  test('zeigt andere Fehler als Meldung, der zweite Tipp wiederholt', async () => {
    let versuche = 0
    const { beiErfolg, beiKontingentErschoepft } = rendern()
    // Nach `rendern`: Spaeter angemeldete Handler gehen vor (MSW stellt `use` voran).
    mockServer.use(
      http.post('*/teams/generieren', () => {
        versuche += 1
        return versuche === 1
          ? problem(409, 'TEILNEHMER_GEAENDERT', 'Die Teilnehmerliste hat sich geändert. Bitte erneut versuchen.')
          : HttpResponse.json(
              { erzeugtAm: '2099-01-13T17:00:00Z', erzeugtVon: 'Beispielspieler 03', veraltet: false, teamA: [], teamB: [] },
              { status: 201 },
            )
      }),
    )
    await userEvent.click(screen.getByTestId('teams-generieren'))

    expect(await screen.findByTestId('teams-fehler')).toHaveTextContent('Die Teilnehmerliste hat sich geändert.')
    expect(beiKontingentErschoepft).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('teams-generieren'))
    await waitFor(() => expect(beiErfolg).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('teams-fehler')).not.toBeInTheDocument()
    expect(versuche).toBe(2)
  })

  test('zeigt waehrend des Laufs den Ladezustand und nimmt keinen zweiten Tipp an', async () => {
    let laeufe = 0
    const { beiErfolg } = rendern()
    mockServer.use(
      http.post('*/teams/generieren', async () => {
        laeufe += 1
        await delay(150)
        return HttpResponse.json(
          { erzeugtAm: '2099-01-13T17:00:00Z', erzeugtVon: 'Beispielspieler 03', veraltet: false, teamA: [], teamB: [] },
          { status: 201 },
        )
      }),
    )
    const knopf = screen.getByTestId('teams-generieren')
    await userEvent.click(knopf)
    expect(knopf).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(knopf)

    await waitFor(() => expect(beiErfolg).toHaveBeenCalledTimes(1))
    expect(laeufe).toBe(1)
  })

  test('zeigt das verbleibende Kontingent nur, wenn die Seite es kennt', () => {
    const { unmount } = render(
      <QueryUmgebung>
        <TeamsLeiste
          terminId={102}
          vorhanden={false}
          veraltet={false}
          berechtigt
          mindestzahlErreicht
          minTeilnehmer={6}
          begonnen={false}
          gesperrtDurchKontingent={false}
          beiErfolg={() => {}}
          beiKontingentErschoepft={() => {}}
          kontingent={{ uebrig: 1, max: 2 }}
        />
      </QueryUmgebung>,
    )
    expect(screen.getByTestId('teams-kontingent')).toHaveTextContent('noch 1 von 2 Generierungen')
    unmount()
    rendern()
    expect(screen.queryByTestId('teams-kontingent')).not.toBeInTheDocument()
  })
})
