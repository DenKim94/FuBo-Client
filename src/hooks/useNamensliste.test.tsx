import { renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useNamensliste } from '@/hooks/useNamensliste'
import { beispielNamensliste, problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useNamensliste', () => {
  test('liefert die Namensliste samt Belegtstatus', async () => {
    const { result } = renderHook(() => useNamensliste(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toEqual(beispielNamensliste))
  })

  test('pollt und markiert jeden Abruf als Hintergrundabruf', async () => {
    const koepfe: (string | null)[] = []
    let belegt = false
    mockServer.use(
      http.get('*/auth/users/lesen', ({ request }) => {
        koepfe.push(request.headers.get('X-FuBo-Kein-Refresh'))
        const antwort = [{ id: 11, name: 'Beispielspieler 01', belegt }]
        belegt = true // ab dem zweiten Abruf ist der Name belegt
        return HttpResponse.json(antwort)
      }),
    )

    const { result } = renderHook(() => useNamensliste(50), { wrapper: QueryUmgebung })

    // Der Belegtstatus aendert sich ohne Zutun der Ansicht.
    await waitFor(() => expect(result.current.data?.[0].belegt).toBe(true))
    expect(koepfe.length).toBeGreaterThanOrEqual(2)
    // Sonst hielte allein das Polling die Sitzung am Leben.
    expect(koepfe.every((k) => k === 'true')).toBe(true)
  })

  test('meldet ein Sitzungsende waehrend des Pollings', async () => {
    mockServer.use(
      http.get('*/auth/users/lesen', () => problem(401, 'SESSION_UNGUELTIG', 'Abgelaufen.')),
    )
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)

    renderHook(() => useNamensliste(), { wrapper: QueryUmgebung })

    // Zurueck zur PIN uebernimmt der SitzungsWaechter ueber diesen Rueckruf.
    await waitFor(() => expect(abmelden).toHaveBeenCalled())
  })
})
