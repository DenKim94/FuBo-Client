import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useProfilAnlegen } from '@/hooks/admin/useProfilAnlegen'
import { useProfilBearbeiten } from '@/hooks/admin/useProfilBearbeiten'
import { useProfilBlockieren } from '@/hooks/admin/useProfilBlockieren'
import { useProfilEntfernen } from '@/hooks/admin/useProfilEntfernen'
import { useProfile } from '@/hooks/admin/useProfile'
import { useTermin } from '@/hooks/useTermin'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/**
 * Beobachtet die Profilliste und einen Termin neben den Mutationen: `invalidateQueries` lädt nur
 * beobachtete Abfragen neu (Falle aus C1), und ohne sie zeigte der Test nicht, ob die Anzeige
 * tatsächlich aktuell wird.
 */
function hookRendern() {
  return renderHook(
    () => ({
      profile: useProfile(),
      termin: useTermin(102, 0),
      anlegen: useProfilAnlegen(),
      bearbeiten: useProfilBearbeiten(),
      blockieren: useProfilBlockieren(),
      entfernen: useProfilEntfernen(),
    }),
    { wrapper: QueryUmgebung },
  )
}

async function bereit(result: ReturnType<typeof hookRendern>['result']) {
  await waitFor(() => {
    expect(result.current.profile.data).toBeDefined()
    expect(result.current.termin.data).toBeDefined()
  })
}

/** Welt mit Profilen und einem Termin. */
function welten() {
  const welt = adminWelt()
  const termine = terminHandlers([terminModell({ terminId: 102 })])
  mockServer.use(...adminHandler(welt), ...termine.handlers)
  return { welt, termine }
}

describe('useProfilAnlegen', () => {
  test('legt an, liest die Liste neu und liefert die Id', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)

    let angelegt
    await act(async () => {
      angelegt = await result.current.anlegen.mutateAsync({
        name: 'Beispielspieler 09',
        skills: { ANGRIFF: 3, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 },
      })
    })

    expect(angelegt).toEqual({ spielerId: 100, name: 'Beispielspieler 09' })
    await waitFor(() => expect(result.current.profile.data?.some((p) => p.name === 'Beispielspieler 09')).toBe(true))
    expect(welt.protokoll.profilAbrufe).toHaveLength(2)
  })

  test('bleibt pending, bis die Liste neu gelesen ist: danach steht das neue Profil schon da', async () => {
    const welt = adminWelt()
    let abrufe = 0
    let beantwortet = 0
    mockServer.use(
      http.get('*/admin/user/lesen', async () => {
        abrufe += 1
        if (abrufe > 1) await delay(150)
        beantwortet += 1
        return HttpResponse.json(welt.profile)
      }),
      ...adminHandler(welt),
    )
    const { result } = hookRendern()
    await waitFor(() => expect(result.current.profile.data).toBeDefined())

    await act(async () => {
      await result.current.anlegen.mutateAsync({
        name: 'Beispielspieler 09',
        skills: { ANGRIFF: 3, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 },
      })
    })

    // Ohne `return` der Neu-Lese-Gruppe löste die Mutation vor dem verzögerten Abruf auf.
    expect(beantwortet).toBe(2)
    await waitFor(() => expect(result.current.profile.data?.some((p) => p.name === 'Beispielspieler 09')).toBe(true))
  })

  test('wiederholt bei 500 nicht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/admin/user/anlegen', () => {
        versuche += 1
        return problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')
      }),
    )
    const { result } = renderHook(() => useProfilAnlegen(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync({ name: 'A', skills: {} }).catch(() => undefined))

    expect(versuche).toBe(1)
  })

  test('409 NAME_BELEGT kommt als ApiFehler an, die Liste wird nicht neu gelesen', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)

    const fehler = await act(() =>
      result.current.anlegen
        .mutateAsync({
          name: 'beispielspieler 01',
          skills: { ANGRIFF: 3, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 },
        })
        .catch((e: unknown) => e),
    )

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe('NAME_BELEGT')
    expect(welt.protokoll.profilAbrufe).toHaveLength(1)
  })
})

describe('useProfilBearbeiten', () => {
  test('liest Profile und Termine neu (Skillwerte ändern die teilnehmerVersion)', async () => {
    const { welt, termine } = welten()
    const { result } = hookRendern()
    await bereit(result)
    const detailVorher = termine.protokoll.detailabrufe.length

    await act(() => result.current.bearbeiten.mutateAsync({ spielerId: 1, skills: { ANGRIFF: 5 } }))

    await waitFor(() => expect(result.current.profile.data?.[0].skills.ANGRIFF).toBe(5))
    expect(welt.protokoll.bearbeitet).toEqual([{ spielerId: 1, skills: { ANGRIFF: 5 } }])
    // Ohne `terminAlle` bliebe der Termin auf dem alten Stand (Gegenprobe M14).
    expect(termine.protokoll.detailabrufe.length).toBeGreaterThan(detailVorher)
  })

  test('bleibt pending, bis Profile und Termine neu gelesen sind', async () => {
    const { welt } = welten()
    mockServer.use(
      http.get('*/admin/user/lesen', async () => {
        await delay(120)
        return HttpResponse.json(welt.profile)
      }),
    )
    const { result } = hookRendern()
    await waitFor(() => expect(result.current.profile.data).toBeDefined())
    let mutation!: Promise<void>
    act(() => {
      mutation = result.current.bearbeiten.mutateAsync({ spielerId: 1, name: 'Beispielspieler 11' })
    })
    // Die Antwort der Mutation ist da, die Liste noch nicht: noch `pending`.
    await waitFor(() => expect(welt.protokoll.bearbeitet).toHaveLength(1))
    expect(result.current.bearbeiten.isPending).toBe(true)

    await act(() => mutation)

    await waitFor(() => expect(result.current.bearbeiten.isPending).toBe(false))
    expect(result.current.profile.data?.[0].name).toBe('Beispielspieler 11')
  })

  test('404: liest die Liste neu und reicht den Fehler weiter', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)
    welt.profile = welt.profile.filter((p) => p.spielerId !== 1)

    const fehler = await act(() =>
      result.current.bearbeiten.mutateAsync({ spielerId: 1, name: 'X' }).catch((e: unknown) => e),
    )

    expect((fehler as ApiFehler).status).toBe(404)
    await waitFor(() => expect(result.current.profile.data?.some((p) => p.spielerId === 1)).toBe(false))
  })

  test('wiederholt bei 500 nicht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/admin/user/bearbeiten', () => {
        versuche += 1
        return problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')
      }),
    )
    const { result } = renderHook(() => useProfilBearbeiten(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync({ spielerId: 1, name: 'X' }).catch(() => undefined))

    expect(versuche).toBe(1)
  })
})

describe('useProfilBlockieren', () => {
  test('sperrt, liest die Liste neu und der Spieler ist nicht mehr online', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)

    await act(() => result.current.blockieren.mutateAsync({ spielerId: 3, blockieren: true }))

    await waitFor(() => expect(result.current.profile.data?.find((p) => p.spielerId === 3)?.aktiv).toBe(false))
    expect(result.current.profile.data?.find((p) => p.spielerId === 3)?.belegt).toBe(false)
    expect(welt.protokoll.blockiert).toEqual([{ spielerId: 3, blockieren: true }])
  })

  test('entsperrt', async () => {
    welten()
    const { result } = hookRendern()
    await bereit(result)

    await act(() => result.current.blockieren.mutateAsync({ spielerId: 2, blockieren: false }))

    await waitFor(() => expect(result.current.profile.data?.find((p) => p.spielerId === 2)?.aktiv).toBe(true))
  })

  test('404 liest die Liste neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)
    welt.profile = welt.profile.filter((p) => p.spielerId !== 2)

    await act(() => result.current.blockieren.mutateAsync({ spielerId: 2, blockieren: true }).catch(() => undefined))

    await waitFor(() => expect(result.current.profile.data?.some((p) => p.spielerId === 2)).toBe(false))
  })
})

describe('useProfilEntfernen', () => {
  test('entfernt und liest die Liste neu', async () => {
    const { welt } = welten()
    const { result } = hookRendern()
    await bereit(result)

    await act(() => result.current.entfernen.mutateAsync(5))

    await waitFor(() => expect(result.current.profile.data?.some((p) => p.spielerId === 5)).toBe(false))
    expect(welt.protokoll.entfernt).toEqual([{ spielerId: 5 }])
  })

  test('409 PROFIL_IN_VERWENDUNG: Fehler, Liste unverändert', async () => {
    const { welt } = welten()
    welt.inVerwendung.add(1)
    const { result } = hookRendern()
    await bereit(result)

    const fehler = await act(() => result.current.entfernen.mutateAsync(1).catch((e: unknown) => e))

    expect((fehler as ApiFehler).code).toBe('PROFIL_IN_VERWENDUNG')
    expect(result.current.profile.data?.some((p) => p.spielerId === 1)).toBe(true)
    expect(welt.protokoll.profilAbrufe).toHaveLength(1)
  })

  test('401 SESSION_UNGUELTIG beendet die Sitzung global', async () => {
    mockServer.use(http.post('*/admin/user/entfernen', () => problem(401, 'SESSION_UNGUELTIG', 'Abgelaufen.')))
    let beendet = 0
    sitzungsendeBehandeln(() => {
      beendet += 1
    })
    const { result } = renderHook(() => useProfilEntfernen(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync(1).catch(() => undefined))

    expect(beendet).toBe(1)
  })
})
