import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useNameBestaetigen } from '@/hooks/admin/useNameBestaetigen'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useNameBestaetigen', () => {
  test('schickt nur die PIN ab und laesst die Sitzung bestehen', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/admin/name/bestaetigen', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    queryClient.setQueryData(['sitzung'], { stage: 'PROFILE_AUTHENTICATED' })
    const { result } = renderHook(() => useNameBestaetigen(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync({ bestaetigungsPin: '12345' }))

    expect(gesendet).toEqual({ bestaetigungsPin: '12345' })
    expect(sitzungsende).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['sitzung'])).toEqual({ stage: 'PROFILE_AUTHENTICATED' })
  })

  test('401 NAME_PIN_FALSCH beendet die Sitzung nicht', async () => {
    // Gegenprobe zu SESSION_UNGUELTIG: derselbe Status, ein anderer Code.
    mockServer.use(
      http.post('*/admin/name/bestaetigen', () => problem(401, 'NAME_PIN_FALSCH', 'Die PIN ist nicht korrekt.')),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    queryClient.setQueryData(['sitzung'], { stage: 'PROFILE_AUTHENTICATED' })
    const { result } = renderHook(() => useNameBestaetigen(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate({ bestaetigungsPin: '00000' }))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect((result.current.error as ApiFehler).code).toBe('NAME_PIN_FALSCH')
    expect(sitzungsende).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['sitzung'])).toEqual({ stage: 'PROFILE_AUTHENTICATED' })
  })

  test('401 SESSION_UNGUELTIG beendet die Sitzung', async () => {
    mockServer.use(
      http.post('*/admin/name/bestaetigen', () => problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.')),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    const { result } = renderHook(() => useNameBestaetigen(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate({ bestaetigungsPin: '12345' }))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(sitzungsende).toHaveBeenCalledOnce()
  })

  test('wiederholt bei 409 und bei einem Serverfehler nicht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/admin/name/bestaetigen', () => {
        versuche += 1
        return problem(503, 'VERSAND_FEHLGESCHLAGEN', 'Nicht erreichbar.')
      }),
    )
    const { result } = renderHook(() => useNameBestaetigen(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate({ bestaetigungsPin: '12345' }))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(versuche).toBe(1)
  })
})
