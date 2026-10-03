import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useGastAnmelden } from '@/hooks/useGastAnmelden'
import { useSitzung } from '@/hooks/useSitzung'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useGastAnmelden', () => {
  test('sendet die Angaben und liest danach die Gastsitzung', async () => {
    let rumpf: unknown
    let angemeldet = false
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        HttpResponse.json(
          angemeldet
            ? { stage: 'PROFILE_AUTHENTICATED', rolle: 'GAST', anzeigeName: 'Testgast' }
            : { stage: 'PIN_VERIFIED' },
        ),
      ),
      http.post('*/auth/gast/anmelden', async ({ request }) => {
        rumpf = await request.json()
        angemeldet = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(
      () => ({ gast: useGastAnmelden(), sitzung: useSitzung() }),
      { wrapper: QueryUmgebung },
    )
    await waitFor(() => expect(result.current.sitzung.pinGeprueft).toBe(true))

    await act(() => result.current.gast.mutateAsync({ gastName: 'Testgast', stufe: 'SCHWACH' }))

    expect(rumpf).toEqual({ gastName: 'Testgast', stufe: 'SCHWACH' })
    expect(queryClient.getQueryData(schluessel.sitzung)).toMatchObject({ rolle: 'GAST' })
  })

  test('liefert bei vollen Gastplaetzen den ApiFehler', async () => {
    mockServer.use(
      http.post('*/auth/gast/anmelden', () =>
        problem(409, 'KEIN_GAST_SLOT_FREI', 'Es sind bereits alle Gastplätze belegt.'),
      ),
    )
    const { result } = renderHook(() => useGastAnmelden(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate({ gastName: 'Testgast' }))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as ApiFehler).code).toBe('KEIN_GAST_SLOT_FREI')
  })
})
