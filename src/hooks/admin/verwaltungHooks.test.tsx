import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useGaesteFreigeben } from '@/hooks/admin/useGaesteFreigeben'
import { useGastplaetze } from '@/hooks/admin/useGastplaetze'
import { useGastStufe } from '@/hooks/admin/useGastStufe'
import { useErgebnisKorrigieren } from '@/hooks/admin/useErgebnisKorrigieren'
import { useHalleAbsagen } from '@/hooks/admin/useHalleAbsagen'
import { useKonfiguration } from '@/hooks/admin/useKonfiguration'
import { useKonfigurationAendern } from '@/hooks/admin/useKonfigurationAendern'
import { useTeamsManuell } from '@/hooks/admin/useTeamsManuell'
import { useBilanz } from '@/hooks/useBilanz'
import { useTermin } from '@/hooks/useTermin'
import { adminHandler, adminWelt, beispielKonfiguration } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { beispielBilanz, terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  vi.useRealTimers()
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Ergebnis eines abgeschlossenen Termins (Beispieldaten). */
const ERGEBNIS = {
  sieger: 'A' as const,
  deutlich: false,
  erfasstVon: 'Beispielspieler 11',
  erfasstAm: '2099-01-13T21:00:00Z',
  korrigiertAm: null,
  version: 1,
}

function welten(modelle: TerminModell[] = [terminModell({ terminId: 101, datum: '2099-01-06' })], teil: Parameters<typeof adminWelt>[0] = {}) {
  const welt = adminWelt({ termine: modelle, ...teil })
  const lesen = terminHandlers(welt.termine)
  // Admin zuerst: `terminHandlers` kennt einen Pfad `*/teams/generieren`, der sonst auch den Adminpfad trifft.
  mockServer.use(...adminHandler(welt), ...lesen.handlers)
  return { welt, lesen }
}

describe('Lesehooks der Stufe 4', () => {
  test('useKonfiguration liest einmal, ohne Kopf, pollt nicht, lädt beim Fensterwechsel nicht neu und gibt den Cache sofort frei', async () => {
    const { welt } = welten()
    const { result } = renderHook(() => useKonfiguration(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const optionen = queryClient.getQueryCache().find({ queryKey: schluessel.adminKonfiguration })?.observers[0].options
    expect(optionen?.refetchInterval).toBe(false)
    expect(optionen?.refetchOnWindowFocus).toBe(false)
    expect(optionen?.gcTime).toBe(0)
    expect(welt.protokoll.konfigurationAbrufe).toEqual([null])
  })

  test('useKonfiguration ruft nach 60 Sekunden Fake-Zeit nicht ein zweites Mal ab', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'], shouldAdvanceTime: true })
    const { welt } = welten()
    const { result } = renderHook(() => useKonfiguration(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toBeDefined())

    await vi.advanceTimersByTimeAsync(60_000)

    expect(welt.protokoll.konfigurationAbrufe).toHaveLength(1)
  })

  test('useGastplaetze liest einmal, ohne Kopf, und pollt nicht', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'], shouldAdvanceTime: true })
    const { welt } = welten()
    const { result } = renderHook(() => useGastplaetze(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toHaveLength(4))

    await vi.advanceTimersByTimeAsync(60_000)

    expect(welt.protokoll.gaesteAbrufe).toEqual([null])
  })

  test('useGastplaetze(false) liest erst, wenn es aktiv wird', async () => {
    const { welt } = welten()
    const { result, rerender } = renderHook(({ aktiv }) => useGastplaetze(aktiv), { wrapper: QueryUmgebung, initialProps: { aktiv: false } })
    await act(async () => {
      await delay(30)
    })
    expect(welt.protokoll.gaesteAbrufe).toEqual([])

    rerender({ aktiv: true })

    await waitFor(() => expect(result.current.data).toHaveLength(4))
    expect(welt.protokoll.gaesteAbrufe).toEqual([null])
  })
})

describe('useKonfigurationAendern', () => {
  const anfrage = () => {
    const rest: Partial<ReturnType<typeof beispielKonfiguration>> = { ...beispielKonfiguration() }
    delete rest.geaendertAm
    return rest as Omit<ReturnType<typeof beispielKonfiguration>, 'geaendertAm'>
  }

  test('schreibt und liest die Konfiguration neu (neue version); bleibt pending, bis sie da ist', async () => {
    const { welt } = welten()
    let abrufe = 0
    mockServer.use(
      http.get('*/admin/config/lesen', async () => {
        abrufe += 1
        if (abrufe > 1) await delay(150)
        return undefined
      }),
    )
    const { result } = renderHook(() => ({ lesen: useKonfiguration(), aendern: useKonfigurationAendern() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.lesen.data?.version).toBe(1))

    let fertig = false
    await act(async () => {
      void result.current.aendern.mutateAsync({ ...anfrage(), anzGuests: 6 }).then(() => {
        fertig = true
      })
      await delay(60)
      // Die Neulesung läuft noch (150 ms): Die Mutation ist noch nicht durch.
      expect(fertig).toBe(false)
      await delay(300)
    })

    expect(fertig).toBe(true)
    await waitFor(() => expect(result.current.lesen.data?.version).toBe(2))
    expect(result.current.lesen.data?.anzGuests).toBe(6)
    expect(welt.konfiguration.anzGuests).toBe(6)
  })

  test('liest bei DATEN_VERALTET sofort neu (E5) und wiederholt nicht', async () => {
    const { welt } = welten()
    const { result } = renderHook(() => ({ lesen: useKonfiguration(), aendern: useKonfigurationAendern() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.lesen.data?.version).toBe(1))
    welt.fremdeKonfigurationAenderung({ pushErinnerungStunden: 12 })

    await act(async () => {
      await result.current.aendern.mutateAsync(anfrage()).catch(() => undefined)
    })

    await waitFor(() => expect((result.current.aendern.error as ApiFehler | null)?.code).toBe('DATEN_VERALTET'))
    await waitFor(() => expect(result.current.lesen.data?.version).toBe(2))
    expect(result.current.lesen.data?.pushErinnerungStunden).toBe(12)
    expect(welt.protokoll.konfigurationGeaendert).toHaveLength(1)
  })

  test('wiederholt bei 500 nicht von selbst', async () => {
    welten()
    let aufrufe = 0
    mockServer.use(
      http.post('*/admin/config/aendern', () => {
        aufrufe += 1
        return problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')
      }),
    )
    const { result } = renderHook(() => useKonfigurationAendern(), { wrapper: QueryUmgebung })

    await act(async () => {
      await result.current.mutateAsync(anfrage()).catch(() => undefined)
    })
    await act(async () => {
      await delay(100)
    })

    expect(aufrufe).toBe(1)
  })
})

describe('useGaesteFreigeben', () => {
  test('sendet slotIds, nie alle, und liest die Gastplätze neu', async () => {
    const { welt } = welten()
    const { result } = renderHook(() => ({ lesen: useGastplaetze(), freigeben: useGaesteFreigeben() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.lesen.data?.[1].belegt).toBe(true))

    await act(async () => {
      await result.current.freigeben.mutateAsync([2])
    })

    expect(welt.protokoll.gaesteFreigegeben).toEqual([{ slotIds: [2] }])
    await waitFor(() => expect(result.current.lesen.data?.[1].belegt).toBe(false))
  })

  test('bei 400 (unbekannte Nummer) bleibt der Fehler stehen und es gibt keinen zweiten Versuch', async () => {
    const { welt } = welten()
    const { result } = renderHook(() => useGaesteFreigeben(), { wrapper: QueryUmgebung })

    await act(async () => {
      await result.current.mutateAsync([77]).catch(() => undefined)
    })

    await waitFor(() => expect((result.current.error as ApiFehler | null)?.status).toBe(400))
    expect(welt.protokoll.gaesteFreigegeben).toHaveLength(1)
  })
})

describe('useGastStufe', () => {
  test('ändert die Stufe und liest Termin und Gastplätze neu', async () => {
    const { welt, lesen } = welten()
    const { result } = renderHook(() => ({ termin: useTermin(101, 0), plaetze: useGastplaetze(), stufe: useGastStufe() }), {
      wrapper: QueryUmgebung,
    })
    await waitFor(() => expect(result.current.termin.data?.teilnehmerVersion).toBe(1))
    const detailVorher = lesen.protokoll.detailabrufe.length
    const gaesteVorher = welt.protokoll.gaesteAbrufe.length

    await act(async () => {
      await result.current.stufe.mutateAsync({ terminId: 101, gastName: 'Beispielgast', stufe: 'SCHWACH' })
    })

    await waitFor(() => expect(result.current.termin.data?.teilnehmerVersion).toBe(2))
    expect(lesen.protokoll.detailabrufe.length).toBeGreaterThan(detailVorher)
    expect(welt.protokoll.gaesteAbrufe.length).toBeGreaterThan(gaesteVorher)
  })

  test('bei 404 (Gast ist weg) liest er den Termin trotzdem neu', async () => {
    const { lesen } = welten()
    const { result } = renderHook(() => ({ termin: useTermin(101, 0), stufe: useGastStufe() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.termin.data).toBeDefined())
    const vorher = lesen.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.stufe.mutateAsync({ terminId: 101, gastName: 'Unbekannt', stufe: 'MITTEL' }).catch(() => undefined)
    })

    await waitFor(() => expect((result.current.stufe.error as ApiFehler | null)?.status).toBe(404))
    expect(lesen.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
  })
})

describe('useHalleAbsagen', () => {
  const halle = () =>
    welten([terminModell({ terminId: 101, datum: '2099-01-06' })], {
      konfiguration: beispielKonfiguration({ hallenModusAktiv: true, halleEmail: 'halle@beispiel.example' }),
    })

  test('sagt ab und liest den Termin neu: ABGESAGT, halleAbgesagtAm gesetzt', async () => {
    const { welt } = halle()
    const { result } = renderHook(() => ({ termin: useTermin(101, 0), absagen: useHalleAbsagen() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.termin.data?.status).toBe('GEPLANT'))

    await act(async () => {
      await result.current.absagen.mutateAsync(101)
    })

    expect(welt.protokoll.halleAbgesagt).toEqual([{ terminId: 101 }])
    await waitFor(() => expect(result.current.termin.data?.status).toBe('ABGESAGT'))
    expect(result.current.termin.data?.halleAbgesagtAm).toEqual(expect.any(String))
  })

  test('HALLE_BEREITS_ABGESAGT liest den Termin neu, damit der Zeitpunkt da ist', async () => {
    const { welt } = halle()
    welt.termine[0].halleAbgesagtAm = '2099-01-01T10:00:00Z'
    const { result } = renderHook(() => ({ termin: useTermin(101, 0), absagen: useHalleAbsagen() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.termin.data).toBeDefined())
    // Der Termin ist beim Laden noch ohne Zeitpunkt, wie bei einem veralteten Gerät.
    welt.termine[0].halleAbgesagtAm = null
    await act(async () => {
      await result.current.termin.refetch()
    })
    welt.termine[0].halleAbgesagtAm = '2099-01-01T10:00:00Z'

    await act(async () => {
      await result.current.absagen.mutateAsync(101).catch(() => undefined)
    })

    await waitFor(() => expect((result.current.absagen.error as ApiFehler | null)?.code).toBe('HALLE_BEREITS_ABGESAGT'))
    await waitFor(() => expect(result.current.termin.data?.halleAbgesagtAm).toBe('2099-01-01T10:00:00Z'))
  })

  test('HALLE_MODUS_INAKTIV liest die Konfiguration neu', async () => {
    const { welt } = halle()
    const { result } = renderHook(() => ({ konfig: useKonfiguration(), absagen: useHalleAbsagen() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.konfig.data?.hallenModusAktiv).toBe(true))
    welt.fremdeKonfigurationAenderung({ hallenModusAktiv: false })

    await act(async () => {
      await result.current.absagen.mutateAsync(101).catch(() => undefined)
    })

    await waitFor(() => expect((result.current.absagen.error as ApiFehler | null)?.code).toBe('HALLE_MODUS_INAKTIV'))
    await waitFor(() => expect(result.current.konfig.data?.hallenModusAktiv).toBe(false))
  })

  test('503 VERSAND_FEHLGESCHLAGEN lässt alles stehen und wiederholt nicht von selbst; die Wiederholung von Hand geht', async () => {
    const { welt } = halle()
    welt.mailFehler = true
    const { result } = renderHook(() => ({ termin: useTermin(101, 0), absagen: useHalleAbsagen() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.termin.data).toBeDefined())

    await act(async () => {
      await result.current.absagen.mutateAsync(101).catch(() => undefined)
    })
    await act(async () => {
      await delay(100)
    })

    await waitFor(() => expect((result.current.absagen.error as ApiFehler | null)?.status).toBe(503))
    expect(welt.protokoll.halleAbgesagt).toHaveLength(1)
    expect(welt.termine[0].status).toBe('GEPLANT')
    expect(welt.termine[0].halleAbgesagtAm ?? null).toBeNull()

    welt.mailFehler = false
    await act(async () => {
      await result.current.absagen.mutateAsync(101)
    })
    expect(welt.termine[0].status).toBe('ABGESAGT')
  })
})

describe('useErgebnisKorrigieren', () => {
  const abgeschlossen = () =>
    welten([terminModell({ terminId: 101, datum: '2099-01-06', status: 'ABGESCHLOSSEN', ergebnis: { ...ERGEBNIS } })])

  test('korrigiert, liest den Termin neu (neue version) und die Bilanz', async () => {
    const { welt } = abgeschlossen()
    let bilanzAbrufe = 0
    mockServer.use(
      http.get('*/bilanz/lesen', () => {
        bilanzAbrufe += 1
        return HttpResponse.json(beispielBilanz)
      }),
    )
    const { result } = renderHook(
      () => ({ termin: useTermin(101, 0), bilanz: useBilanz(), korrigieren: useErgebnisKorrigieren() }),
      { wrapper: QueryUmgebung },
    )
    await waitFor(() => expect(result.current.termin.data?.ergebnis?.version).toBe(1))
    await waitFor(() => expect(result.current.bilanz.data).toBeDefined())
    const vorher = bilanzAbrufe

    await act(async () => {
      await result.current.korrigieren.mutateAsync({ terminId: 101, sieger: 'B', deutlich: true, version: 1 })
    })

    expect(welt.protokoll.ergebnisKorrigiert).toEqual([{ terminId: 101, sieger: 'B', deutlich: true, version: 1 }])
    await waitFor(() => expect(result.current.termin.data?.ergebnis).toMatchObject({ sieger: 'B', deutlich: true, version: 2 }))
    expect(bilanzAbrufe).toBeGreaterThan(vorher)
  })

  test('bei DATEN_VERALTET liest er den Termin neu (frischer Stand) und wiederholt nicht', async () => {
    const { welt } = abgeschlossen()
    const { result } = renderHook(() => ({ termin: useTermin(101, 0), korrigieren: useErgebnisKorrigieren() }), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.termin.data?.ergebnis?.version).toBe(1))
    welt.fremdeErgebnisAenderung(101, { sieger: 'U' })

    await act(async () => {
      await result.current.korrigieren.mutateAsync({ terminId: 101, sieger: 'B', deutlich: false, version: 1 }).catch(() => undefined)
    })

    await waitFor(() => expect((result.current.korrigieren.error as ApiFehler | null)?.code).toBe('DATEN_VERALTET'))
    await waitFor(() => expect(result.current.termin.data?.ergebnis).toMatchObject({ sieger: 'U', version: 2 }))
    expect(welt.protokoll.ergebnisKorrigiert).toHaveLength(1)
  })
})

describe('useTeamsManuell', () => {
  test('liefert die Einteilung im Zustand des Hooks, liest nichts neu und legt nichts im Cache ab', async () => {
    const { welt } = welten()
    const { result } = renderHook(() => useTeamsManuell(), { wrapper: QueryUmgebung })
    const cacheVorher = queryClient.getQueryCache().getAll().length

    await act(async () => {
      await result.current.mutateAsync({ spielerIds: [1, 5], gaeste: [{ stufe: 'MITTEL' }] }).catch(() => undefined)
    })

    // Drei Teilnehmer, Mindestzahl 6: der Server lehnt ab; der Zustand trägt den Fehler, nicht den Cache.
    await waitFor(() => expect((result.current.error as ApiFehler | null)?.code).toBe('ZU_WENIG_TEILNEHMER'))
    expect(welt.protokoll.teamsManuell).toHaveLength(1)
    expect(queryClient.getQueryCache().getAll().length).toBe(cacheVorher)
  })

  test('bei Erfolg steht das Ergebnis in data, und reset() verwirft es', async () => {
    const { welt } = welten([], { konfiguration: beispielKonfiguration({ minTeilnehmer: 2 }) })
    const { result } = renderHook(() => useTeamsManuell(), { wrapper: QueryUmgebung })

    await act(async () => {
      await result.current.mutateAsync({ spielerIds: [1, 5] })
    })

    await waitFor(() => expect(result.current.data?.teamA.length).toBe(1))
    expect(result.current.data?.differenzTeamstaerke).toBe(1.25)
    expect(queryClient.getQueryCache().getAll().some((q) => q.state.data === result.current.data)).toBe(false)

    act(() => {
      result.current.reset()
    })

    await waitFor(() => expect(result.current.data).toBeUndefined())
    expect(welt.protokoll.teamsManuell).toHaveLength(1)
  })
})
