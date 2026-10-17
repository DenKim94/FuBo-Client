import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useTermin } from '@/hooks/useTermin'
import { useTermine } from '@/hooks/useTermine'
import { beispielTermine, terminHandlers, terminModell } from '@/test/mocks/termine'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useTermine', () => {
  test('liefert die Liste in der Reihenfolge des Servers', async () => {
    const { result } = renderHook(() => useTermine(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toEqual(beispielTermine))
  })

  test('pollt und markiert jeden Abruf als Hintergrundabruf', async () => {
    const welt = terminHandlers()
    mockServer.use(...welt.handlers)

    renderHook(() => useTermine(50), { wrapper: QueryUmgebung })

    await waitFor(() => expect(welt.protokoll.listenabrufe.length).toBeGreaterThanOrEqual(3))
    // Sonst hielte allein das Polling die Sitzung am Leben (Falle aus C3).
    expect(welt.protokoll.listenabrufe.every((kopf) => kopf === 'true')).toBe(true)
    // Das Dashboard fragt nie nach vergangenen Terminen: kein `ab`.
    expect(welt.protokoll.stichtage.every((ab) => ab === null)).toBe(true)
  })

  test('zeigt eine Aenderung am Server ohne Zutun der Ansicht', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102 })])
    mockServer.use(...welt.handlers)
    const { result } = renderHook(() => useTermine(50), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data?.[0].zusagen).toBe(8))

    welt.modelle[0].zusagen.push({ name: 'Beispielspieler 99', gast: false })

    await waitFor(() => expect(result.current.data?.[0].zusagen).toBe(9))
  })
})

describe('useTermin', () => {
  test('liefert Teilnehmerliste samt Kennzahlen', async () => {
    const { result } = renderHook(() => useTermin(102), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.teilnehmerliste.minTeilnehmer).toBe(6)
    expect(result.current.data?.teilnehmerliste.maxTeilnehmer).toBe(22)
  })

  test('ruft ohne Id nichts ab', async () => {
    const welt = terminHandlers()
    mockServer.use(...welt.handlers)

    const { result } = renderHook(() => useTermin(undefined, 50), { wrapper: QueryUmgebung })

    // Zeit genug fuer mehrere Takte: Es darf kein einziger Abruf stattfinden.
    await new Promise((fertig) => setTimeout(fertig, 200))
    expect(welt.protokoll.detailabrufe).toEqual([])
    expect(result.current.fetchStatus).toBe('idle')
  })

  test('pollt mit Hintergrundkopf', async () => {
    const welt = terminHandlers()
    mockServer.use(...welt.handlers)

    renderHook(() => useTermin(102, 50), { wrapper: QueryUmgebung })

    await waitFor(() => expect(welt.protokoll.detailabrufe.length).toBeGreaterThanOrEqual(3))
    expect(welt.protokoll.detailabrufe.every((kopf) => kopf === 'true')).toBe(true)
  })

  test('meldet 404 als Fehler mit Code, ohne zu wiederholen', async () => {
    const { result } = renderHook(() => useTermin(999), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 404, code: 'INHALT_NICHT_GEFUNDEN' })
  })
})
