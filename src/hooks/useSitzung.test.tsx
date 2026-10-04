import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { useSitzung } from '@/hooks/useSitzung'
import { beispielSitzung } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  vi.useRealTimers()
  queryClient.clear()
})

/**
 * Zählt die Sitzungsabrufe **ohne** `X-FuBo-Kein-Refresh` – also die, mit denen
 * der Server das Leerlauf-Fenster nach hinten schiebt.
 */
function verlaengerndeAbrufeZaehlen(): { anzahl: number } {
  const zaehler = { anzahl: 0 }
  mockServer.use(
    http.get('*/auth/session/lesen', ({ request }) => {
      if (request.headers.get('X-FuBo-Kein-Refresh') !== 'true') zaehler.anzahl += 1
      return HttpResponse.json(beispielSitzung)
    }),
  )
  return zaehler
}

/** Lässt die Daten veralten (`staleTime` 10 s), ohne die Timer von MSW anzuhalten. */
function datenVeralten() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + 60_000)
}

/** Rückkehr in den Tab; das Ereignis muss aufsteigen, TanStack Query hört am `window`. */
function rueckkehrInDenTab() {
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
}

/** Verbindung weg und wieder da (`onlineManager` hört auf `offline`/`online`). */
function wiederverbinden() {
  window.dispatchEvent(new Event('offline'))
  window.dispatchEvent(new Event('online'))
}

/** Gibt Abrufen, die das Ereignis eventuell ausgelöst hat, Zeit zum Ankommen. */
async function kurzWarten() {
  await act(() => new Promise((fertig) => setTimeout(fertig, 50)))
}

describe('useSitzung', () => {
  test('liest die Sitzung bei der Rückkehr in den Tab nicht neu (keine Verlängerung ohne Bedienung)', async () => {
    const abrufe = verlaengerndeAbrufeZaehlen()
    const { result } = renderHook(() => useSitzung(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.angemeldet).toBe(true))
    expect(abrufe.anzahl).toBe(1)

    datenVeralten()
    act(() => rueckkehrInDenTab())
    await kurzWarten()

    expect(abrufe.anzahl).toBe(1)
  })

  test('liest die Sitzung nach einer Wiederverbindung nicht neu', async () => {
    const abrufe = verlaengerndeAbrufeZaehlen()
    const { result } = renderHook(() => useSitzung(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.angemeldet).toBe(true))

    datenVeralten()
    act(() => wiederverbinden())
    await kurzWarten()

    expect(abrufe.anzahl).toBe(1)
  })

  test('holt den Stand bei der Rückkehr nach, wenn der Startaufruf ohne Verbindung scheiterte', async () => {
    mockServer.use(http.get('*/auth/session/lesen', () => HttpResponse.error(), { once: true }))
    const { result } = renderHook(() => useSitzung(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.laedt).toBe(false))
    expect(result.current.angemeldet).toBe(false)

    act(() => rueckkehrInDenTab())

    await waitFor(() => expect(result.current.angemeldet).toBe(true))
  })

  test('holt den Stand nach der Wiederverbindung nach, wenn der Startaufruf ohne Verbindung scheiterte', async () => {
    mockServer.use(http.get('*/auth/session/lesen', () => HttpResponse.error(), { once: true }))
    const { result } = renderHook(() => useSitzung(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.laedt).toBe(false))

    act(() => wiederverbinden())

    await waitFor(() => expect(result.current.angemeldet).toBe(true))
  })
})
