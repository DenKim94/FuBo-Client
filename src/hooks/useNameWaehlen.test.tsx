import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useNameWaehlen } from '@/hooks/useNameWaehlen'
import { useNamensliste } from '@/hooks/useNamensliste'
import { useSitzung } from '@/hooks/useSitzung'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useNameWaehlen', () => {
  test('liest nach dem Erfolg die neue Sitzung, bevor es Erfolg meldet', async () => {
    let gewaehlt = false
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        HttpResponse.json({ stage: gewaehlt ? 'PROFILE_AUTHENTICATED' : 'PIN_VERIFIED' }),
      ),
      http.post('*/auth/user/waehlen', () => {
        gewaehlt = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    // Mit `useSitzung`, wie in der Anwendung der Guard: Nur eine beobachtete
    // Abfrage wird beim Invalidieren sofort neu gelesen.
    const { result } = renderHook(
      () => ({ waehlen: useNameWaehlen(), sitzung: useSitzung() }),
      { wrapper: QueryUmgebung },
    )
    await waitFor(() => expect(result.current.sitzung.pinGeprueft).toBe(true))

    await act(() => result.current.waehlen.mutateAsync(11))

    // Unmittelbar nach dem Ende der Mutation steht die neue Stufe im Cache.
    expect(queryClient.getQueryData(schluessel.sitzung)).toEqual({ stage: 'PROFILE_AUTHENTICATED' })
  })

  test('liest bei belegtem Namen die Namensliste sofort neu', async () => {
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/users/lesen', () => {
        abrufe += 1
        return HttpResponse.json([{ id: 11, name: 'Beispielspieler 01', belegt: abrufe > 1 }])
      }),
      http.post('*/auth/user/waehlen', () =>
        problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits angemeldet.'),
      ),
    )
    // Langes Intervall: Das Neulesen darf nicht vom Polling kommen.
    const { result } = renderHook(
      () => ({ liste: useNamensliste(60_000), waehlen: useNameWaehlen() }),
      { wrapper: QueryUmgebung },
    )
    await waitFor(() => expect(result.current.liste.data?.[0].belegt).toBe(false))

    act(() => result.current.waehlen.mutate(11))

    await waitFor(() => expect(result.current.liste.data?.[0].belegt).toBe(true))
    const fehler = result.current.waehlen.error
    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe('NAME_BELEGT')
  })
})
