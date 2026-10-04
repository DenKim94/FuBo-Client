import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useAbmelden } from '@/hooks/useAbmelden'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useAbmelden', () => {
  test('widerruft die Sitzung auf dem Server und raeumt danach im Client auf', async () => {
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    let methode = ''
    mockServer.use(
      http.post('*/auth/session/beenden', ({ request }) => {
        methode = request.method
        return new HttpResponse(null, { status: 204 })
      }),
    )
    // Daten der abgemeldeten Person, die nicht stehen bleiben duerfen.
    queryClient.setQueryData(['termine'], [{ id: 1 }])
    const { result } = renderHook(() => useAbmelden(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync())

    expect(methode).toBe('POST')
    // Derselbe Weg wie beim Ablauf: Rueckruf zur PIN-Eingabe, Cache leer.
    expect(abmelden).toHaveBeenCalledOnce()
    expect(queryClient.getQueryData(['termine'])).toBeUndefined()
  })

  test('bleibt bei einem Fehler angemeldet und zeigt ihn', async () => {
    // Stilles Abmelden im Client bei weiter gueltiger Sitzung liesse einen
    // Gastplatz belegt und die Sitzung offen – gegen das, was die Oberflaeche sagt.
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    mockServer.use(
      http.post('*/auth/session/beenden', () =>
        problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.'),
      ),
    )
    queryClient.setQueryData(['termine'], [{ id: 1 }])
    const { result } = renderHook(() => useAbmelden(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiFehler)
    expect(abmelden).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['termine'])).toEqual([{ id: 1 }])
  })

  test('raeumt auch bei bereits beendeter Sitzung genau einmal auf', async () => {
    // 401 SESSION_UNGUELTIG: Die globale Behandlung greift. Die Person ist am
    // Ziel – abgemeldet –, und es darf nicht doppelt umgeleitet werden.
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    mockServer.use(
      http.post('*/auth/session/beenden', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )
    const { result } = renderHook(() => useAbmelden(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate())

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(abmelden).toHaveBeenCalledOnce()
  })
})
