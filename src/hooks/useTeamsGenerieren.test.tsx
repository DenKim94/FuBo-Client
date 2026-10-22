import { act, renderHook, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useTeamsGenerieren } from '@/hooks/useTeamsGenerieren'
import { useTermin } from '@/hooks/useTermin'
import { useTermine } from '@/hooks/useTermine'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Beobachtet Einzeltermin und Liste neben der Mutation (`invalidateQueries` lädt nur Beobachtetes). */
function hookRendern() {
  return renderHook(
    () => ({
      liste: useTermine(60_000),
      termin: useTermin(102, 60_000),
      generieren: useTeamsGenerieren(102),
    }),
    { wrapper: QueryUmgebung },
  )
}

async function warteAufDaten(result: ReturnType<typeof hookRendern>['result']) {
  await waitFor(() => {
    expect(result.current.liste.data).toBeDefined()
    expect(result.current.termin.data).toBeDefined()
  })
}

describe('useTeamsGenerieren', () => {
  test('liest nach dem Lauf den Einzeltermin neu und zeigt die Einteilung', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    // `null` ist der Normalzustand „noch nicht generiert“.
    expect(result.current.termin.data?.teams).toBeNull()

    await act(() => result.current.generieren.mutateAsync())

    await waitFor(() => expect(result.current.termin.data?.teams).not.toBeNull())
    expect(result.current.termin.data?.teams?.veraltet).toBe(false)
    expect(result.current.termin.data?.teams?.teamA.length).toBeGreaterThan(0)
  })

  test('sendet den Lauf ohne Hintergrundkopf', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)

    await act(() => result.current.generieren.mutateAsync())

    expect(welt.protokoll.generierungen).toEqual([{ terminId: 102, kopf: null }])
  })

  test('markiert die Einteilung nach einer fremden Zusage als veraltet', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    await act(() => result.current.generieren.mutateAsync())

    // Jemand anderes sagt zu: Die Teilnehmerversion steigt.
    welt.modelle[0].zusagen.push({ name: 'Beispielspieler 30', gast: false })
    welt.modelle[0].teilnehmerVersion += 1
    await act(() => result.current.termin.refetch())

    expect(result.current.termin.data?.teams?.veraltet).toBe(true)
    // Die Einteilung bleibt sichtbar.
    expect(result.current.termin.data?.teams?.teamA.length).toBeGreaterThan(0)
  })

  test.each(['TERMIN_GESCHLOSSEN', 'TEAMS_FIXIERT', 'TEILNEHMER_GEAENDERT', 'KONTINGENT_ERSCHOEPFT'] as const)(
    'liest bei 409 %s neu',
    async (code) => {
      const welt = terminHandlers([terminModell({ terminId: 102, eigene: true })])
      mockServer.use(http.post('*/teams/generieren', () => problem(409, code, 'Text.')), ...welt.handlers)
      const { result } = hookRendern()
      await warteAufDaten(result)
      const vorher = welt.protokoll.detailabrufe.length

      await act(async () => {
        await result.current.generieren.mutateAsync().catch(() => {})
      })

      await waitFor(() => expect(result.current.generieren.isError).toBe(true))
      expect(result.current.generieren.error).toMatchObject({ status: 409, code })
      expect(welt.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
    },
  )

  test('liest bei 403 KEINE_ZUSAGE neu (die eigene Zusage ist inzwischen zurückgenommen)', async () => {
    // Das Modell ohne eigene Zusage: Der nachgebildete Server weist wie der echte mit 403 ab.
    const welt = terminHandlers([terminModell({ terminId: 102 })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.generieren.mutateAsync().catch(() => {})
    })

    await waitFor(() => expect(result.current.generieren.error).toMatchObject({ status: 403, code: 'KEINE_ZUSAGE' }))
    expect(welt.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
  })

  test('liest bei 404 neu', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true })])
    mockServer.use(
      http.post('*/teams/generieren', () => problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')),
      ...welt.handlers,
    )
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.generieren.mutateAsync().catch(() => {})
    })

    expect(welt.protokoll.detailabrufe.length).toBeGreaterThan(vorher)
  })

  test('wiederholt bei 500 nicht und liest nicht neu: Ein Lauf verbraucht Kontingent', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true })])
    let versuche = 0
    mockServer.use(
      http.post('*/teams/generieren', () => {
        versuche += 1
        return problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.')
      }),
      ...welt.handlers,
    )
    const { result } = hookRendern()
    await warteAufDaten(result)
    const vorher = welt.protokoll.detailabrufe.length

    await act(async () => {
      await result.current.generieren.mutateAsync().catch(() => {})
    })

    expect(versuche).toBe(1)
    expect(welt.protokoll.detailabrufe.length).toBe(vorher)
    await waitFor(() => expect(result.current.generieren.isError).toBe(true))
  })

  test('antwortet nach dem Kontingent mit 409; eine Absage öffnet es nicht, eine neue Zusage schon', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true, kontingent: 1, kontingentVersion: 1 })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)
    await act(() => result.current.generieren.mutateAsync())

    await act(async () => {
      await result.current.generieren.mutateAsync().catch(() => {})
    })
    await waitFor(() => expect(result.current.generieren.error).toMatchObject({ code: 'KONTINGENT_ERSCHOEPFT' }))

    // Jemand sagt ab: neue Teilnehmerversion, aber derselbe Kontingentstand (Server seit 22.10.2026).
    welt.modelle[0].teilnehmerVersion += 1
    await act(async () => {
      await result.current.generieren.mutateAsync().catch(() => {})
    })
    await waitFor(() => expect(result.current.generieren.error).toMatchObject({ code: 'KONTINGENT_ERSCHOEPFT' }))

    // Jemand sagt neu zu: Teilnehmerversion und Kontingentstand steigen, das Kontingent steht wieder offen.
    welt.modelle[0].teilnehmerVersion += 1
    welt.modelle[0].kontingentVersion = 2
    await act(() => result.current.generieren.mutateAsync())
    expect(welt.protokoll.generierungen).toHaveLength(4)
  })

  test('verlangt die Mindestzahl vom Server: zu wenig Zusagen ergeben 409 ZU_WENIG_TEILNEHMER', async () => {
    const welt = terminHandlers([terminModell({ terminId: 102, eigene: true, min: 20 })])
    mockServer.use(...welt.handlers)
    const { result } = hookRendern()
    await warteAufDaten(result)

    await act(async () => {
      await result.current.generieren.mutateAsync().catch(() => {})
    })

    await waitFor(() => expect(result.current.generieren.error).toMatchObject({ code: 'ZU_WENIG_TEILNEHMER' }))
  })
})
