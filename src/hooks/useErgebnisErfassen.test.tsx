import { act, renderHook, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useBilanz } from '@/hooks/useBilanz'
import { useErgebnisErfassen } from '@/hooks/useErgebnisErfassen'
import { useTermin } from '@/hooks/useTermin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { EIGENER_NAME, teamsAus, terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Ein abgeschlossener Termin mit Einteilung, in der der Spieler dieser Sitzung in Team A steht. */
function abgeschlossen(teil: Partial<TerminModell> = {}): TerminModell {
  const modell = terminModell({
    terminId: 102,
    datum: '2000-01-01',
    status: 'ABGESCHLOSSEN',
    zusagen: [
      { name: EIGENER_NAME, gast: false },
      { name: 'Beispielspieler 11', gast: false },
      { name: 'Beispielspieler 12', gast: false },
      { name: 'Beispielspieler 13', gast: false },
    ],
    eigene: true,
    ...teil,
  })
  return { ...modell, teams: teamsAus(modell, 'Beispielspieler 01'), teamsVersion: modell.teilnehmerVersion }
}

/** Beobachtet Einzeltermin und Bilanz neben der Mutation (`invalidateQueries` lädt nur Beobachtetes). */
function hookRendern() {
  return renderHook(
    () => ({
      termin: useTermin(102, 60_000),
      bilanz: useBilanz(),
      erfassen: useErgebnisErfassen(102),
    }),
    { wrapper: QueryUmgebung },
  )
}

async function warteAufDaten(result: ReturnType<typeof hookRendern>['result']) {
  await waitFor(() => {
    expect(result.current.termin.data).toBeDefined()
    expect(result.current.bilanz.data).toBeDefined()
  })
}

describe('useErgebnisErfassen', () => {
  test('liest nach dem Erfassen Einzeltermin und Bilanz neu', async () => {
    const welt = terminHandlers([abgeschlossen()])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    // `null` ist der Normalzustand „noch nicht erfasst“.
    expect(result.current.termin.data?.ergebnis).toBeNull()
    expect(result.current.bilanz.data).toEqual({ siege: 0, niederlagen: 0, unentschieden: 0 })

    await act(() => result.current.erfassen.mutateAsync({ sieger: 'A', deutlich: true }))

    await waitFor(() => expect(result.current.termin.data?.ergebnis).not.toBeNull())
    expect(result.current.termin.data?.ergebnis).toMatchObject({ sieger: 'A', deutlich: true, erfasstVon: EIGENER_NAME })
    // Der eigene Spieler stand in Team A: ein Sieg mehr.
    await waitFor(() => expect(result.current.bilanz.data?.siege).toBe(1))
  })

  test('sendet das Ergebnis ohne Hintergrundkopf und bei Unentschieden ohne deutlich', async () => {
    const welt = terminHandlers([abgeschlossen()])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)

    await act(() => result.current.erfassen.mutateAsync({ sieger: 'U', deutlich: true }))

    expect(welt.protokoll.erfassungen).toEqual([{ terminId: 102, sieger: 'U', deutlich: false, kopf: null }])
  })

  test('liest bei 409 ERGEBNIS_VORHANDEN neu und zeigt das vorhandene Ergebnis', async () => {
    // Jemand war schneller: Das Ergebnis steht schon am Server, die Anzeige kennt es noch nicht.
    const welt = terminHandlers([abgeschlossen()])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    welt.modelle[0].ergebnis = {
      sieger: 'B',
      deutlich: false,
      erfasstVon: 'Beispielspieler 01',
      erfasstAm: '2099-01-13T21:00:00Z',
      korrigiertAm: null,
      version: 1,
    }

    await act(async () => {
      await result.current.erfassen.mutateAsync({ sieger: 'A', deutlich: false }).catch(() => {})
    })

    await waitFor(() => expect(result.current.erfassen.error).toMatchObject({ status: 409, code: 'ERGEBNIS_VORHANDEN' }))
    await waitFor(() => expect(result.current.termin.data?.ergebnis?.erfasstVon).toBe('Beispielspieler 01'))
    // Der erste Eintrag gilt: Das eigene Ergebnis hat nichts ueberschrieben.
    expect(result.current.termin.data?.ergebnis?.sieger).toBe('B')
  })

  test.each([
    ['TERMIN_NICHT_ABGESCHLOSSEN', { status: 'GEPLANT' as const }],
    ['KEINE_EINTEILUNG', { teams: null }],
  ] as const)('liest bei 409 %s neu', async (code, abweichung) => {
    const welt = terminHandlers([{ ...abgeschlossen(), ...abweichung }])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.erfassen.mutateAsync({ sieger: 'A', deutlich: false }).catch(() => {})
    })

    await waitFor(() => expect(result.current.erfassen.error).toMatchObject({ status: 409, code }))
    expect(welt.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
  })

  test('liest bei 403 NICHT_EINGETEILT neu und schreibt nichts', async () => {
    // Die eigene Sitzung steht nicht in der Einteilung: Der nachgebildete Server weist wie der echte ab.
    const modell = abgeschlossen({
      zusagen: [
        { name: 'Beispielspieler 11', gast: false },
        { name: 'Beispielspieler 12', gast: false },
      ],
      eigene: false,
    })
    const welt = terminHandlers([modell])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.erfassen.mutateAsync({ sieger: 'A', deutlich: false }).catch(() => {})
    })

    await waitFor(() => expect(result.current.erfassen.error).toMatchObject({ status: 403, code: 'NICHT_EINGETEILT' }))
    expect(welt.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
    expect(welt.modelle[0].ergebnis).toBeNull()
  })

  test('wiederholt bei 500 nicht und liest nicht neu', async () => {
    const welt = terminHandlers([abgeschlossen()])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    let versuche = 0
    mockServer.use(
      http.post('*/ergebnis/erfassen', () => {
        versuche += 1
        return problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.')
      }),
    )
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.erfassen.mutateAsync({ sieger: 'A', deutlich: false }).catch(() => {})
    })

    expect(versuche).toBe(1)
    expect(welt.protokoll.detailabrufe.length).toBe(vorher)
    await waitFor(() => expect(result.current.erfassen.isError).toBe(true))
  })
})
