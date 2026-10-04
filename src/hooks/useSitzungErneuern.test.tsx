import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import type { SitzungInfo } from '@/api/auth/auth'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useRestlaufzeit } from '@/hooks/useRestlaufzeit'
import { useSitzungErneuern } from '@/hooks/useSitzungErneuern'
import { problem, sitzungMitRest } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Restlaufzeit in Millisekunden, wie sie jetzt im Cache steht (Leerlauf-Fenster). */
function restImCache(): number {
  const sitzung = queryClient.getQueryData<SitzungInfo>(schluessel.sitzungFrist)
  if (!sitzung) throw new Error('Keine Restlaufzeit im Cache')
  return Date.parse(sitzung.gueltigBis) - Date.now()
}

describe('useSitzungErneuern', () => {
  test('liest nach dem Erfolg die Restlaufzeit neu, bevor es Erfolg meldet', async () => {
    let erneuert = false
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        HttpResponse.json(erneuert ? sitzungMitRest(900, 3600) : sitzungMitRest(90, 3600)),
      ),
      http.post('*/auth/session/erneuern', () => {
        erneuert = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    // Mit `useRestlaufzeit` daneben, wie im Dialog: Nur eine beobachtete
    // Abfrage wird beim Invalidieren sofort neu gelesen.
    const { result } = renderHook(
      () => ({ erneuern: useSitzungErneuern(), frist: useRestlaufzeit() }),
      { wrapper: QueryUmgebung },
    )
    await waitFor(() => expect(result.current.frist.warnen).toBe(true))

    await act(() => result.current.erneuern.mutateAsync())

    // Unmittelbar nach dem Ende der Mutation steht der neue Stand im Cache.
    expect(restImCache()).toBeGreaterThan(800_000)
    await waitFor(() => expect(result.current.frist.warnen).toBe(false))
  })

  test('uebernimmt nicht den noch laufenden Abruf von vor der Verlaengerung', async () => {
    // Erster Abruf antwortet spaet mit dem alten Stand. Ohne Abbruch haengte
    // sich das Neulesen an ihn an (ein Abruf ohne Daten wird beim Invalidieren
    // uebernommen, nicht ersetzt) und lieferte 90 statt 900 Sekunden.
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', async () => {
        abrufe += 1
        if (abrufe === 1) {
          await delay(300)
          return HttpResponse.json(sitzungMitRest(90, 3600))
        }
        return HttpResponse.json(sitzungMitRest(900, 3600))
      }),
    )
    const { result } = renderHook(
      () => ({ erneuern: useSitzungErneuern(), frist: useRestlaufzeit() }),
      { wrapper: QueryUmgebung },
    )
    await waitFor(() => expect(abrufe).toBe(1))

    await act(() => result.current.erneuern.mutateAsync())

    expect(restImCache()).toBeGreaterThan(800_000)
  })

  test('meldet einen Fehler als ApiFehler und liest die Restlaufzeit nicht neu', async () => {
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => {
        abrufe += 1
        return HttpResponse.json(sitzungMitRest(90, 3600))
      }),
      http.post('*/auth/session/erneuern', () =>
        problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.'),
      ),
    )
    const { result } = renderHook(
      () => ({ erneuern: useSitzungErneuern(), frist: useRestlaufzeit() }),
      { wrapper: QueryUmgebung },
    )
    await waitFor(() => expect(result.current.frist.warnen).toBe(true))

    act(() => result.current.erneuern.mutate())

    await waitFor(() => expect(result.current.erneuern.isError).toBe(true))
    expect(result.current.erneuern.error).toBeInstanceOf(ApiFehler)
    expect(result.current.erneuern.error?.message).toBe('Unerwarteter Fehler.')
    expect(abrufe).toBe(1)
    expect(queryClient.getQueryData(schluessel.sitzungFrist)).toBeDefined()
  })

  test('versucht bei einem Fehler nicht von selbst ein zweites Mal', async () => {
    // Mutationen wiederholen nie (queryClient.ts): Eine Zeitueberschreitung
    // darf nicht stillschweigend ein zweites Mal verlaengern.
    let aufrufe = 0
    mockServer.use(
      http.post('*/auth/session/erneuern', () => {
        aufrufe += 1
        return problem(503, 'INTERNER_FEHLER', 'Nicht verfügbar.')
      }),
    )
    const { result } = renderHook(() => useSitzungErneuern(), { wrapper: QueryUmgebung })

    act(() => result.current.mutate())
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(aufrufe).toBe(1)
  })
})
