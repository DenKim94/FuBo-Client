import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useSerieAnlegen } from '@/hooks/admin/useSerieAnlegen'
import { useTerminAbsagen } from '@/hooks/admin/useTerminAbsagen'
import { useTerminAendern } from '@/hooks/admin/useTerminAendern'
import { useTerminAnlegen } from '@/hooks/admin/useTerminAnlegen'
import { useTerminEntfernen } from '@/hooks/admin/useTerminEntfernen'
import { useTermin } from '@/hooks/useTermin'
import { useTermine } from '@/hooks/useTermine'
import { useVerlauf } from '@/hooks/useVerlauf'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell, uebersichtVon } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/**
 * Beobachtet Liste, Verlauf und einen Einzeltermin neben den Mutationen: `invalidateQueries` lädt nur
 * beobachtete Abfragen neu (Falle aus C1), und ohne sie zeigte der Test nicht, ob die Anzeige tatsächlich
 * aktuell wird.
 */
function hookRendern() {
  return renderHook(
    () => ({
      liste: useTermine(0),
      verlauf: useVerlauf(),
      termin: useTermin(101, 0),
      anlegen: useTerminAnlegen(),
      serie: useSerieAnlegen(),
      aendern: useTerminAendern(),
      absagen: useTerminAbsagen(),
      entfernen: useTerminEntfernen(),
    }),
    { wrapper: QueryUmgebung },
  )
}

/** Welt mit zwei geplanten Terminen im Jahr 2099; Termin 101 ohne Zusagen, 102 mit Zusagen. */
function welten() {
  const welt = adminWelt({
    termine: [
      terminModell({ terminId: 101, datum: '2099-01-06', zusagen: [] }),
      terminModell({ terminId: 102, datum: '2099-01-13' }),
    ],
  })
  const lesen = terminHandlers(welt.termine)
  mockServer.use(...lesen.handlers, ...adminHandler(welt))
  return { welt, lesen }
}

async function bereit(result: ReturnType<typeof hookRendern>['result']) {
  await waitFor(() => {
    expect(result.current.liste.data).toBeDefined()
    expect(result.current.verlauf.data).toBeDefined()
    expect(result.current.termin.data).toBeDefined()
  })
}

describe('useTerminAnlegen', () => {
  test('legt an und liest Liste, Einzeltermin und Verlauf neu', async () => {
    const { lesen } = welten()
    const { result } = hookRendern()
    await bereit(result)
    const listeVorher = lesen.protokoll.listenabrufe.length
    const detailVorher = lesen.protokoll.detailabrufe.length

    let angelegt
    await act(async () => {
      angelegt = await result.current.anlegen.mutateAsync({ datum: '2099-02-03', uhrzeit: '20:00' })
    })

    expect(angelegt).toEqual({ terminId: 103, datum: '2099-02-03', uhrzeit: '20:00:00' })
    await waitFor(() => expect(result.current.liste.data?.some((t) => t.terminId === 103)).toBe(true))
    // Liste und Verlauf teilen sich die Funktion `termineLesen`: je ein Abruf mehr (Gegenprobe M14).
    expect(lesen.protokoll.listenabrufe.length).toBe(listeVorher + 2)
    expect(lesen.protokoll.detailabrufe.length).toBe(detailVorher + 1)
  })

  test('bleibt pending, bis die Liste neu gelesen ist', async () => {
    const welt = adminWelt({ termine: [terminModell({ terminId: 101, datum: '2099-01-06', zusagen: [] })] })
    const lesen = terminHandlers(welt.termine)
    let beantwortet = 0
    let abrufe = 0
    mockServer.use(
      // Innerhalb eines Aufrufs gewinnt der erste Treffer: der verzögernde Handler steht vorn.
      http.get('*/termine/lesen', async () => {
        abrufe += 1
        if (abrufe > 2) await delay(150)
        beantwortet += 1
        return HttpResponse.json(welt.termine.map(uebersichtVon))
      }),
      ...lesen.handlers,
      ...adminHandler(welt),
    )
    const { result } = hookRendern()
    await bereit(result)
    const beantwortetVorher = beantwortet

    await act(async () => {
      await result.current.anlegen.mutateAsync({ datum: '2099-02-03', uhrzeit: '20:00' })
    })

    // Ohne `return` der Neu-Lese-Gruppe löste die Mutation vor den verzögerten Abrufen auf.
    expect(beantwortet).toBe(beantwortetVorher + 2)
  })

  test('409 TERMIN_BELEGT kommt als ApiFehler an, es wird nichts neu gelesen', async () => {
    const { lesen } = welten()
    const { result } = hookRendern()
    await bereit(result)
    const listeVorher = lesen.protokoll.listenabrufe.length

    const fehler = await act(() =>
      result.current.anlegen.mutateAsync({ datum: '2099-01-06', uhrzeit: '19:00' }).catch((e: unknown) => e),
    )

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe('TERMIN_BELEGT')
    expect(lesen.protokoll.listenabrufe).toHaveLength(listeVorher)
  })

  test('wiederholt bei 500 nicht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/admin/termin/anlegen', () => {
        versuche += 1
        return problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')
      }),
    )
    const { result } = renderHook(() => useTerminAnlegen(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync({ datum: '2099-02-03', uhrzeit: '20:00' }).catch(() => undefined))

    expect(versuche).toBe(1)
  })
})

describe('useSerieAnlegen', () => {
  test('legt die Serie an, liefert angelegte und übersprungene Zeitpunkte und liest neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)

    let ergebnis
    await act(async () => {
      // 2099-01-06 ist ein Dienstag und mit 19:00 schon belegt (Termin 101).
      ergebnis = await result.current.serie.mutateAsync({
        titel: 'Beispielserie',
        wochentag: 2,
        uhrzeit: '19:00',
        startdatum: '2099-01-01',
        enddatum: '2099-01-20',
      })
    })

    expect(ergebnis).toMatchObject({
      titel: 'Beispielserie',
      uebersprungeneTermine: ['2099-01-06', '2099-01-13'],
      angelegteTermine: [{ datum: '2099-01-20' }],
    })
    expect(welt.termine).toHaveLength(3)
    await waitFor(() => expect(result.current.liste.data).toHaveLength(3))
  })
})

describe('useTerminAendern', () => {
  test('ändert mit version und liest neu: das Formular bekommt die neue version', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)
    expect(result.current.termin.data?.version).toBe(1)

    await act(() => result.current.aendern.mutateAsync({ terminId: 101, version: 1, ort: 'Andere Halle' }))

    await waitFor(() => expect(result.current.termin.data?.version).toBe(2))
    expect(result.current.termin.data?.ort).toBe('Andere Halle')
    expect(welt.protokoll.terminGeaendert).toEqual([{ terminId: 101, version: 1, ort: 'Andere Halle' }])
  })

  test('DATEN_VERALTET: liest sofort neu und sendet nicht erneut', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)
    welt.fremdeAenderung(101, { ort: 'Fremde Halle' })

    const fehler = await act(() => result.current.aendern.mutateAsync({ terminId: 101, version: 1, ort: 'Eigene Halle' }).catch((e: unknown) => e))

    expect((fehler as ApiFehler).code).toBe('DATEN_VERALTET')
    // Der frische Stand ist da, ohne dass jemand nachgeladen hätte (Gegenprobe M10).
    await waitFor(() => expect(result.current.termin.data?.version).toBe(2))
    expect(result.current.termin.data?.ort).toBe('Fremde Halle')
    expect(welt.protokoll.terminGeaendert).toHaveLength(1)
  })

  test('TERMIN_GESCHLOSSEN liest ebenfalls neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)
    welt.fremdeAenderung(101, { status: 'ABGESAGT' })

    const fehler = await act(() => result.current.aendern.mutateAsync({ terminId: 101, version: 2, ort: 'X' }).catch((e: unknown) => e))

    expect((fehler as ApiFehler).code).toBe('TERMIN_GESCHLOSSEN')
    await waitFor(() => expect(result.current.termin.data?.status).toBe('ABGESAGT'))
  })

  test('409 TERMIN_BELEGT liest nicht neu', async () => {
    const { lesen } = welten()
    const { result } = hookRendern()
    await bereit(result)
    const detailVorher = lesen.protokoll.detailabrufe.length

    const fehler = await act(() =>
      result.current.aendern.mutateAsync({ terminId: 101, version: 1, datum: '2099-01-13' }).catch((e: unknown) => e),
    )

    expect((fehler as ApiFehler).code).toBe('TERMIN_BELEGT')
    expect(lesen.protokoll.detailabrufe).toHaveLength(detailVorher)
  })
})

describe('useTerminAbsagen', () => {
  test('sagt ab und liest neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)

    await act(() => result.current.absagen.mutateAsync(101))

    await waitFor(() => expect(result.current.termin.data?.status).toBe('ABGESAGT'))
    expect(welt.protokoll.terminAbgesagt).toEqual([{ terminId: 101 }])
  })

  test('ein zweites Absagen liefert TERMIN_GESCHLOSSEN und liest neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)
    welt.fremdeAenderung(101, { status: 'ABGESAGT' })

    const fehler = await act(() => result.current.absagen.mutateAsync(101).catch((e: unknown) => e))

    expect((fehler as ApiFehler).code).toBe('TERMIN_GESCHLOSSEN')
    await waitFor(() => expect(result.current.termin.data?.status).toBe('ABGESAGT'))
  })
})

describe('useTerminEntfernen', () => {
  test('entfernt einen Termin ohne Daten und liest die Liste neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)

    await act(() => result.current.entfernen.mutateAsync(101))

    await waitFor(() => expect(result.current.liste.data?.some((t) => t.terminId === 101)).toBe(false))
    expect(welt.termine.map((t) => t.terminId)).toEqual([102])
  })

  test('TERMIN_IN_VERWENDUNG: der Termin bleibt, die Seite liest den Stand neu', async () => {
    const { lesen } = welten()
    const { result } = hookRendern()
    await bereit(result)
    const listeVorher = lesen.protokoll.listenabrufe.length

    const fehler = await act(() => result.current.entfernen.mutateAsync(102).catch((e: unknown) => e))

    expect((fehler as ApiFehler).code).toBe('TERMIN_IN_VERWENDUNG')
    await waitFor(() => expect(lesen.protokoll.listenabrufe.length).toBeGreaterThan(listeVorher))
    expect(result.current.liste.data?.some((t) => t.terminId === 102)).toBe(true)
  })

  test('404: liest neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)
    welt.termine.splice(0, 1)

    const fehler = await act(() => result.current.entfernen.mutateAsync(101).catch((e: unknown) => e))

    expect((fehler as ApiFehler).status).toBe(404)
    await waitFor(() => expect(result.current.liste.data?.some((t) => t.terminId === 101)).toBe(false))
  })
})
