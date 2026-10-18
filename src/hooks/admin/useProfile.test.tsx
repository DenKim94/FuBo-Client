import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { schluessel } from '@/api/common/schluessel'
import { queryClient } from '@/app/queryClient'
import { useProfile } from '@/hooks/admin/useProfile'
import { SKILLS_STALE_MS, useSkillKategorien } from '@/hooks/admin/useSkillKategorien'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  vi.useRealTimers()
  queryClient.clear()
})

describe('useProfile', () => {
  test('liest die Profile einmal und ohne Hintergrundkopf', async () => {
    const welt = adminWelt()
    mockServer.use(...adminHandler(welt))
    const { result } = renderHook(() => useProfile(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.data).toHaveLength(6))

    expect(welt.protokoll.profilAbrufe).toEqual([null])
    // Das Adminprofil steht am Ende der Liste.
    expect(result.current.data?.at(-1)?.rolle).toBe('ADMIN')
  })

  test('pollt nicht und liest beim Fensterwechsel nicht neu (Optionen der Abfrage)', async () => {
    mockServer.use(...adminHandler(adminWelt()))
    const { result } = renderHook(() => useProfile(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const optionen = queryClient.getQueryCache().find({ queryKey: schluessel.adminProfile })?.observers[0].options
    expect(optionen?.refetchInterval).toBe(false)
    expect(optionen?.refetchOnWindowFocus).toBe(false)
  })

  test('ruft nach 60 Sekunden Fake-Zeit nicht ein zweites Mal ab', async () => {
    const welt = adminWelt()
    mockServer.use(...adminHandler(welt))
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'], shouldAdvanceTime: true })
    const { result } = renderHook(() => useProfile(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toBeDefined())

    await vi.advanceTimersByTimeAsync(60_000)

    expect(welt.protokoll.profilAbrufe).toHaveLength(1)
  })
})

describe('useSkillKategorien', () => {
  test('liest die Kategorien einmal, ohne Hintergrundkopf und ohne Polling', async () => {
    const welt = adminWelt()
    mockServer.use(...adminHandler(welt))
    const { result } = renderHook(() => useSkillKategorien(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.data).toHaveLength(5))

    expect(welt.protokoll.skillAbrufe).toEqual([null])
    const optionen = queryClient.getQueryCache().find({ queryKey: schluessel.adminSkills })?.observers[0].options
    expect(optionen?.refetchInterval).toBe(false)
    expect(optionen?.refetchOnWindowFocus).toBe(false)
    expect(optionen?.staleTime).toBe(SKILLS_STALE_MS)
  })

  test('ein zweiter Beobachter innerhalb der Frischezeit löst keinen weiteren Abruf aus', async () => {
    const welt = adminWelt()
    mockServer.use(...adminHandler(welt))
    const erster = renderHook(() => useSkillKategorien(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(erster.result.current.data).toBeDefined())

    const zweiter = renderHook(() => useSkillKategorien(), { wrapper: QueryUmgebung })

    expect(zweiter.result.current.data).toHaveLength(5)
    expect(welt.protokoll.skillAbrufe).toHaveLength(1)
  })
})
