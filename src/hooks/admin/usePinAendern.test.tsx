import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { HINWEIS_PIN_GEAENDERT, usePinAendern } from '@/hooks/admin/usePinAendern'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('usePinAendern', () => {
  test('schickt die neue PIN ohne Hintergrundkopf ab', async () => {
    let gesendet: unknown
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/admin/pin/aendern', async ({ request }) => {
        gesendet = await request.json()
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => usePinAendern(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync({ neuePin: '4711' }))

    expect(gesendet).toEqual({ neuePin: '4711' })
    expect(kopf).toBeNull()
  })

  test('beendet nach Erfolg die Sitzung im Client: Cache leer, Rueckruf mit Hinweis', async () => {
    // Der Server hat alle Sitzungen widerrufen, auch die des Admins.
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    queryClient.setQueryData(['admin', 'profile'], [{ spielerId: 1 }])
    const { result } = renderHook(() => usePinAendern(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync({ neuePin: '4711' }))

    expect(sitzungsende).toHaveBeenCalledExactlyOnceWith(HINWEIS_PIN_GEAENDERT)
    expect(queryClient.getQueryData(['admin', 'profile'])).toBeUndefined()
  })

  test('der Hinweis nennt den Grund und die naechste Handlung', () => {
    expect(HINWEIS_PIN_GEAENDERT).toBe('Die zentrale PIN wurde geändert. Bitte melde dich mit der neuen PIN an.')
  })

  test('beendet bei 400 EINGABE_UNGUELTIG die Sitzung nicht', async () => {
    mockServer.use(
      http.post('*/admin/pin/aendern', () => problem(400, 'EINGABE_UNGUELTIG', 'Die Eingabe ist ungültig.')),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    const { result } = renderHook(() => usePinAendern(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate({ neuePin: '12' }))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect((result.current.error as ApiFehler).code).toBe('EINGABE_UNGUELTIG')
    expect(sitzungsende).not.toHaveBeenCalled()
  })

  test('wiederholt bei einem Serverfehler nicht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/admin/pin/aendern', () => {
        versuche += 1
        return problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')
      }),
    )
    const { result } = renderHook(() => usePinAendern(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate({ neuePin: '4711' }))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(versuche).toBe(1)
  })
})
