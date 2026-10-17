import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { HINWEIS_PASSWORT_GEAENDERT, usePasswortAendern } from '@/hooks/usePasswortAendern'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

const ANFRAGE = { altesPasswort: 'beispiel-passwort-01', neuesPasswort: 'beispiel-passwort-02' }

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('usePasswortAendern', () => {
  test('schickt beide Passwoerter unveraendert ab', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/admin/passwort/aendern', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => usePasswortAendern(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync(ANFRAGE))

    expect(gesendet).toEqual(ANFRAGE)
  })

  test('beendet nach Erfolg die Sitzung im Client: Cache leer, Rueckruf mit Hinweis', async () => {
    // Der Server hat alle Adminsitzungen widerrufen und das Cookie geloescht;
    // der Client wartet nicht auf den naechsten 401.
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    queryClient.setQueryData(['teilnehmer'], [{ id: 1 }])
    const { result } = renderHook(() => usePasswortAendern(), { wrapper: QueryUmgebung })

    await act(() => result.current.mutateAsync(ANFRAGE))

    expect(sitzungsende).toHaveBeenCalledExactlyOnceWith(HINWEIS_PASSWORT_GEAENDERT)
    expect(queryClient.getQueryData(['teilnehmer'])).toBeUndefined()
  })

  test('der Hinweis nennt den Grund und die naechste Handlung', () => {
    expect(HINWEIS_PASSWORT_GEAENDERT).toBe(
      'Passwort geändert. Bitte melde dich mit dem neuen Passwort an.',
    )
  })

  test('beendet bei falschem bisherigem Passwort die Sitzung nicht', async () => {
    // Gegenprobe: ADMIN_PASSWORT_FALSCH ist ein Eingabefehler mitten in einer
    // gueltigen Sitzung (401, aber kein SESSION_UNGUELTIG).
    mockServer.use(
      http.post('*/admin/passwort/aendern', () =>
        problem(401, 'ADMIN_PASSWORT_FALSCH', 'Das bisherige Passwort ist nicht korrekt.'),
      ),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    queryClient.setQueryData(['teilnehmer'], [{ id: 1 }])
    const { result } = renderHook(() => usePasswortAendern(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate(ANFRAGE))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect((result.current.error as ApiFehler).code).toBe('ADMIN_PASSWORT_FALSCH')
    expect(sitzungsende).not.toHaveBeenCalled()
    expect(queryClient.getQueryData(['teilnehmer'])).toEqual([{ id: 1 }])
  })

  test('beendet bei abgelaufener Sitzung die Sitzung ohne Hinweis (globale Behandlung)', async () => {
    mockServer.use(
      http.post('*/admin/passwort/aendern', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    const { result } = renderHook(() => usePasswortAendern(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate(ANFRAGE))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(sitzungsende).toHaveBeenCalledOnce()
    expect(sitzungsende).toHaveBeenCalledWith(undefined)
  })

  test('wiederholt bei Sperre nicht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/admin/passwort/aendern', () => {
        versuche += 1
        return HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'PIN_GESPERRT',
            detail: 'Zu viele Fehlversuche. Bitte in 30 Sekunden erneut versuchen.',
            wartesekunden: 30,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }),
    )
    const { result } = renderHook(() => usePasswortAendern(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate(ANFRAGE))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(versuche).toBe(1)
    expect((result.current.error as ApiFehler).wartesekunden).toBe(30)
  })
})
