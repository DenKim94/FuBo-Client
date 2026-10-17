import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useBilanz } from '@/hooks/useBilanz'
import { beispielSitzung } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useBilanz', () => {
  test('liest die Bilanz mit Hintergrundkopf', async () => {
    const welt = terminHandlers()
    mockServer.use(...welt.handlers)
    const { result } = renderHook(() => useBilanz(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.data).toEqual({ siege: 0, niederlagen: 0, unentschieden: 0 }))
    // Die Bilanz ist keine Bedienung und haelt die Sitzung nicht offen.
    expect(welt.protokoll.bilanzabrufe).toEqual(['true'])
  })

  test('ruft fuer einen Gast nichts ab', async () => {
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => HttpResponse.json({ ...beispielSitzung, rolle: 'GAST' })),
      http.get('*/bilanz/lesen', () => {
        abrufe += 1
        return HttpResponse.json({ siege: 0, niederlagen: 0, unentschieden: 0 })
      }),
    )
    const { result } = renderHook(() => useBilanz(), { wrapper: QueryUmgebung })

    // Die Sitzung ist erst nach dem Abruf bekannt; danach darf nichts folgen.
    await waitFor(() => expect(queryClient.getQueryData(['sitzung'])).toBeDefined())
    await new Promise((r) => setTimeout(r, 100))
    expect(abrufe).toBe(0)
    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  test('wartet auf die Sitzung, statt jeden fuer einen Nicht-Gast zu halten', async () => {
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', async () => {
        await new Promise((r) => setTimeout(r, 80))
        return HttpResponse.json({ ...beispielSitzung, rolle: 'GAST' })
      }),
      http.get('*/bilanz/lesen', () => {
        abrufe += 1
        return HttpResponse.json({ siege: 0, niederlagen: 0, unentschieden: 0 })
      }),
    )
    renderHook(() => useBilanz(), { wrapper: QueryUmgebung })

    await new Promise((r) => setTimeout(r, 250))
    expect(abrufe).toBe(0)
  })
})
