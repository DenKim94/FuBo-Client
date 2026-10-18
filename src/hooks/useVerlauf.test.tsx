import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { schluessel } from '@/api/common/schluessel'
import { heuteIso, verlaufAb } from '@/api/termine/terminZeit'
import { useTermine } from '@/hooks/useTermine'
import { useVerlauf } from '@/hooks/useVerlauf'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Datum vor `tage` Tagen als `YYYY-MM-DD` in Ortszeit. */
function vor(tage: number): string {
  const t = new Date()
  return heuteIso(new Date(t.getFullYear(), t.getMonth(), t.getDate() - tage))
}

/** Aufsteigend wie vom Server: ein alter, zwei vergangene, zwei kommende. */
function welt() {
  return terminHandlers([
    terminModell({ terminId: 1, datum: vor(70), status: 'ABGESCHLOSSEN' }),
    terminModell({ terminId: 2, datum: vor(10), status: 'ABGESAGT', zusagen: [] }),
    terminModell({ terminId: 3, datum: vor(5), status: 'ABGESCHLOSSEN' }),
    terminModell({ terminId: 4, datum: '2099-01-13' }),
    terminModell({ terminId: 5, datum: '2099-01-20', status: 'ABGESAGT', zusagen: [] }),
  ])
}

describe('useVerlauf', () => {
  test('fragt mit dem Stichtag der letzten Tage und ohne Hintergrund-Kopf-Verwechslung', async () => {
    const w = welt()
    mockServer.use(...w.handlers)
    const { result } = renderHook(() => useVerlauf(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(w.protokoll.stichtage).toEqual([verlaufAb(new Date())])
    expect(w.protokoll.listenabrufe).toEqual(['true'])
  })

  test('liefert vergangene Termine, neueste zuerst, ohne kuenftige', async () => {
    mockServer.use(...welt().handlers)
    const { result } = renderHook(() => useVerlauf(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.data).toBeDefined())
    // Der Termin vor 70 Tagen liegt ausserhalb des Fensters; Zukuenftiges (auch Abgesagtes) fehlt.
    expect(result.current.data?.vergangene.map((t) => t.terminId)).toEqual([3, 2])
  })

  test('nennt den zuletzt abgeschlossenen Termin', async () => {
    mockServer.use(...welt().handlers)
    const { result } = renderHook(() => useVerlauf(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.letzter?.terminId).toBe(3)
  })

  test('hat ohne abgeschlossenen Termin keinen letzten', async () => {
    mockServer.use(...terminHandlers([terminModell({ terminId: 4, datum: '2099-01-13' })]).handlers)
    const { result } = renderHook(() => useVerlauf(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.letzter).toBeUndefined()
    expect(result.current.data?.vergangene).toEqual([])
  })

  test('pollt nicht', async () => {
    const w = welt()
    mockServer.use(...w.handlers)
    const { result } = renderHook(() => useVerlauf(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toBeDefined())

    await new Promise((r) => setTimeout(r, 200))
    expect(w.protokoll.listenabrufe).toHaveLength(1)
    expect(queryClient.getQueryCache().find({ queryKey: schluessel.termineVerlauf })?.observers[0].options.refetchInterval).toBeUndefined()
  })

  test('wird von der Invalidierung der Terminliste nicht getroffen', async () => {
    // Eigener Wurzelschluessel: Nach einer Rueckmeldung liest nur das Dashboard neu.
    const w = welt()
    mockServer.use(...w.handlers)
    const { result } = renderHook(() => ({ liste: useTermine(60_000), verlauf: useVerlauf() }), { wrapper: QueryUmgebung })
    await waitFor(() => {
      expect(result.current.liste.data).toBeDefined()
      expect(result.current.verlauf.data).toBeDefined()
    })
    const vorher = w.protokoll.stichtage.length

    await queryClient.invalidateQueries({ queryKey: schluessel.termine })

    // Genau ein weiterer Abruf, und zwar mit dem Stichtag heute: der der Terminliste.
    expect(w.protokoll.stichtage.length).toBe(vorher + 1)
    expect(w.protokoll.stichtage.at(-1)).toBe(heuteIso(new Date()))
  })
})
