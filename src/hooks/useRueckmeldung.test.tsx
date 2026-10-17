import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useRueckmeldung } from '@/hooks/useRueckmeldung'
import { useTermin } from '@/hooks/useTermin'
import { useTermine } from '@/hooks/useTermine'
import { problem } from '@/test/mocks/problem'
import { EIGENER_NAME, detailsVon, terminHandlers, terminModell } from '@/test/mocks/termine'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/**
 * Beobachtet Liste und Einzeltermin neben der Mutation: `invalidateQueries`
 * lädt nur beobachtete Abfragen neu (Falle aus C1), und ohne sie zeigte der
 * Test nicht, ob die Anzeige tatsächlich aktuell wird.
 */
function hookRendern() {
  return renderHook(
    () => ({
      liste: useTermine(60_000),
      termin: useTermin(102, 60_000),
      rueckmeldung: useRueckmeldung(102),
    }),
    { wrapper: QueryUmgebung },
  )
}

/** Wartet, bis Liste und Einzeltermin geladen sind. */
async function warteAufDaten(result: ReturnType<typeof hookRendern>['result']) {
  await waitFor(() => {
    expect(result.current.liste.data).toBeDefined()
    expect(result.current.termin.data).toBeDefined()
  })
}

describe('useRueckmeldung', () => {
  test('liest nach einer Zusage Liste und Einzeltermin neu', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102 })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    expect(result.current.liste.data?.[0].eigeneRueckmeldung).toBeNull()

    await act(() => result.current.rueckmeldung.mutateAsync(true))

    // Ohne die Invalidierung zeigte die Ansicht weiter den alten Stand. `waitFor`,
    // weil React die neuen Daten einen Takt nach der Mutation rendert.
    await waitFor(() => expect(result.current.liste.data?.[0].eigeneRueckmeldung).toBe(true))
    expect(result.current.liste.data?.[0].zusagen).toBe(9)
    expect(result.current.termin.data?.eigeneRueckmeldung).toBe(true)
    expect(result.current.termin.data?.teilnehmerliste.teilnehmer.at(-1)?.anzeigeName).toBe(EIGENER_NAME)
  })

  test('sendet die Rueckmeldung ohne Hintergrundkopf', async () => {
    const welt = terminHandlers()
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)

    await act(() => result.current.rueckmeldung.mutateAsync(false))

    expect(welt.protokoll.rueckmeldungen).toEqual([{ terminId: 102, zusage: false, kopf: null }])
  })

  test('liest auch bei 409 neu: Die Anzeige war veraltet', async () => {
    // Termin hat begonnen (2020, noch GEPLANT): Der Server lehnt mit 409 ab.
    const welt = terminHandlers([terminModell({ terminId: 102, datum: '2020-01-07' })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.rueckmeldung.mutateAsync(true).catch(() => {})
    })

    await waitFor(() => expect(result.current.rueckmeldung.isError).toBe(true))
    expect(result.current.rueckmeldung.error).toMatchObject({ status: 409, code: 'TERMIN_GESCHLOSSEN' })
    expect(welt.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
  })

  test('liest bei 404 neu', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102 })])
    // Überschreibende Handler stehen vorn: MSW nimmt den ersten, der passt.
    mockServer.use(
      http.post('*/termine/rueckmeldung', () => problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')),
      ...welt.handlers,
    )
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.rueckmeldung.mutateAsync(true).catch(() => {})
    })

    expect(welt.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
  })

  test('wiederholt bei 500 nicht und liest nicht neu: der zweite Tipp wiederholt', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102 })])
    let versuche = 0
    mockServer.use(
      http.post('*/termine/rueckmeldung', () => {
        versuche += 1
        return problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.')
      }),
      ...welt.handlers,
    )
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.rueckmeldung.mutateAsync(true).catch(() => {})
    })

    // Ein automatischer zweiter Versuch stellte hinten an, ohne dass jemand tippte.
    expect(versuche).toBe(1)
    expect(welt.protokoll.detailabrufe.length).toBe(vorher)
    await waitFor(() => expect(result.current.rueckmeldung.isError).toBe(true))
  })

  test('stellt eine erneute Zusage hinten an', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true, zusagen: [
      { name: EIGENER_NAME, gast: false },
      { name: 'Beispielspieler 11', gast: false },
    ] })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)

    await act(() => result.current.rueckmeldung.mutateAsync(true))

    await waitFor(() =>
      expect(result.current.termin.data?.teilnehmerliste.teilnehmer.map((t) => t.anzeigeName)).toEqual([
        'Beispielspieler 11',
        EIGENER_NAME,
      ]),
    )
  })

  test('bleibt bis zum neuen Stand in Arbeit', async () => {
    // Die Schaltfläche zeigt den Ladezustand, bis die Anzeige stimmt; erst dann
    // wandert der Fokus.
    const welt = terminHandlers([terminModell({ terminId: 102 })])
    let freigeben: () => void = () => {}
    const gesperrt = new Promise<void>((weiter) => (freigeben = weiter))
    mockServer.use(
      // Nach der Rückmeldung antwortet die Einzelansicht erst auf Freigabe.
      http.get('*/termine/:terminId/lesen', async () => {
        if (welt.protokoll.rueckmeldungen.length > 0) await gesperrt
        return HttpResponse.json(detailsVon(welt.modelle[0]))
      }),
      ...welt.handlers,
    )
    const { result } = hookRendern()
    await waitFor(() => expect(result.current.termin.data).toBeDefined())

    act(() => result.current.rueckmeldung.mutate(true))
    await waitFor(() => expect(welt.protokoll.rueckmeldungen).toHaveLength(1))
    // Die Rückmeldung ist durch, der neue Stand fehlt noch: weiter „in Arbeit“.
    await waitFor(() => expect(result.current.liste.data?.[0].eigeneRueckmeldung).toBe(true))
    expect(result.current.rueckmeldung.isPending).toBe(true)

    freigeben()
    await waitFor(() => expect(result.current.rueckmeldung.isSuccess).toBe(true))
    expect(result.current.termin.data?.eigeneRueckmeldung).toBe(true)
  })
})
