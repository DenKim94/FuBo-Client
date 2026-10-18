import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient } from '@/app/queryClient'
import { useNameAnfordern } from '@/hooks/admin/useNameAnfordern'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => queryClient.clear())

describe('useNameAnfordern', () => {
  test('schickt den Namen ab; 202 ohne Rumpf ist ein Erfolg', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/admin/name/aendern', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 202 })
      }),
    )
    const { result } = renderHook(() => useNameAnfordern(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync({ neuerName: 'Beispieladmin Neu' }))

    expect(gesendet).toEqual({ neuerName: 'Beispieladmin Neu' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  test('wiederholt bei 503 VERSAND_FEHLGESCHLAGEN nicht von selbst, ein zweiter Aufruf geht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/admin/name/aendern', () => {
        versuche += 1
        return versuche === 1
          ? problem(503, 'VERSAND_FEHLGESCHLAGEN', 'Die E-Mail konnte nicht gesendet werden.')
          : new HttpResponse(null, { status: 202 })
      }),
    )
    const { result } = renderHook(() => useNameAnfordern(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate({ neuerName: 'Neu' }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(versuche).toBe(1)
    expect((result.current.error as ApiFehler).code).toBe('VERSAND_FEHLGESCHLAGEN')

    await act(() => result.current.mutateAsync({ neuerName: 'Neu' }))
    expect(versuche).toBe(2)
  })
})
