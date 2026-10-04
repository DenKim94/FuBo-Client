import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import {
  FRIST_INTERVALL_MS,
  FRIST_INTERVALL_NAH_MS,
  useRestlaufzeit,
  WARNZEIT_MS,
} from '@/hooks/useRestlaufzeit'
import { beispielSitzung, problem, sitzungMitRest } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

afterEach(() => {
  vi.useRealTimers()
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Handler, der mit einer Sitzung antwortet, deren Enden relativ zu jetzt liegen. */
function sitzungMitRestHandler(leerlaufSek: number, obergrenzeSek: number) {
  return http.get('*/auth/session/lesen', () =>
    HttpResponse.json(sitzungMitRest(leerlaufSek, obergrenzeSek)),
  )
}

describe('useRestlaufzeit', () => {
  test('ist unbekannt, solange der Server nicht geantwortet hat', () => {
    mockServer.use(sitzungMitRestHandler(600, 3600))
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })

    // Weder warnen noch verlaengern auf Verdacht.
    expect(result.current).toEqual({ restMs: null, verlaengerbar: false, warnen: false })
  })

  test('warnt nicht, solange das Ende fern ist', async () => {
    mockServer.use(sitzungMitRestHandler(600, 3600))
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.restMs).not.toBeNull())

    expect(result.current.warnen).toBe(false)
    expect(result.current.verlaengerbar).toBe(true)
    expect(result.current.restMs!).toBeGreaterThan(WARNZEIT_MS)
  })

  test('warnt innerhalb der Warnzeit und rechnet mit dem Ende des Leerlauf-Fensters', async () => {
    mockServer.use(sitzungMitRestHandler(90, 3600))
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.restMs).not.toBeNull())

    expect(result.current.warnen).toBe(true)
    expect(result.current.verlaengerbar).toBe(true)
    expect(result.current.restMs!).toBeLessThanOrEqual(90_000)
    expect(result.current.restMs!).toBeGreaterThan(85_000)
  })

  test('erklaert die Sitzung fuer nicht verlaengerbar, wenn das Fenster an der Obergrenze endet', async () => {
    // Der Server klemmt `gueltigBis` auf `absolutGueltigBis`: beide sind gleich.
    mockServer.use(
      http.get('*/auth/session/lesen', () => {
        const ende = new Date(Date.now() + 90_000).toISOString()
        return HttpResponse.json({ ...beispielSitzung, gueltigBis: ende, absolutGueltigBis: ende })
      }),
    )
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.restMs).not.toBeNull())

    expect(result.current.warnen).toBe(true)
    expect(result.current.verlaengerbar).toBe(false)
  })

  test('rechnet mit dem frueheren der beiden Zeitpunkte', async () => {
    // Nicht zu erwarten (der Server klemmt), aber die Regel gilt unabhaengig davon.
    mockServer.use(sitzungMitRestHandler(600, 60))
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.restMs).not.toBeNull())

    expect(result.current.restMs!).toBeLessThanOrEqual(60_000)
    expect(result.current.warnen).toBe(true)
    expect(result.current.verlaengerbar).toBe(false)
  })

  test('ruft die Sitzung als Hintergrundaufruf ab, der das Fenster nicht verlaengert', async () => {
    const koepfe: (string | null)[] = []
    mockServer.use(
      http.get('*/auth/session/lesen', ({ request }) => {
        koepfe.push(request.headers.get('X-FuBo-Kein-Refresh'))
        return HttpResponse.json(beispielSitzung)
      }),
    )
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })

    await waitFor(() => expect(result.current.restMs).not.toBeNull())

    expect(koepfe).toEqual(['true'])
  })

  test('zaehlt im Sekundentakt herunter', async () => {
    mockServer.use(sitzungMitRestHandler(600, 3600))
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.restMs).not.toBeNull())
    const anfang = result.current.restMs!

    await waitFor(() => expect(result.current.restMs!).toBeLessThan(anfang), { timeout: 3000 })
  })

  test('fragt nichts ab, solange er nicht aktiv ist', async () => {
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => {
        abrufe += 1
        return HttpResponse.json(beispielSitzung)
      }),
    )
    const { result } = renderHook(() => useRestlaufzeit(false), { wrapper: QueryUmgebung })

    await new Promise((fertig) => setTimeout(fertig, 100))

    expect(abrufe).toBe(0)
    expect(result.current.restMs).toBeNull()
  })

  test('fuehrt bei 401 in die globale Behandlung des Sitzungsendes', async () => {
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })

    // Der Abruf ist es, der den Ablauf bemerkt: Ohne ihn wuerde eine
    // untaetige Person nie zur PIN gefuehrt.
    await waitFor(() => expect(abmelden).toHaveBeenCalledOnce())
  })
})

describe('useRestlaufzeit, Abstand der Abrufe', () => {
  /**
   * Mit laufender, aber lenkbarer Uhr: `shouldAdvanceTime` laesst die Zeit
   * weiterlaufen (MSW und `waitFor` brauchen echte Zeit), `advanceTimersByTime`
   * schiebt sie gezielt voran.
   */
  function uhrAnhalten() {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  }

  test('fragt fern vom Ende nur alle dreissig Sekunden ab', async () => {
    uhrAnhalten()
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => {
        abrufe += 1
        return HttpResponse.json(sitzungMitRest(600, 3600))
      }),
    )
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.restMs).not.toBeNull())
    expect(abrufe).toBe(1)

    await act(() => vi.advanceTimersByTimeAsync(FRIST_INTERVALL_MS - 2_000))
    expect(abrufe).toBe(1)

    await act(() => vi.advanceTimersByTimeAsync(4_000))
    await waitFor(() => expect(abrufe).toBe(2))
  })

  test('fragt in den letzten drei Minuten alle fuenf Sekunden ab', async () => {
    uhrAnhalten()
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => {
        abrufe += 1
        return HttpResponse.json(sitzungMitRest(150, 3600))
      }),
    )
    const { result } = renderHook(() => useRestlaufzeit(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.restMs).not.toBeNull())
    expect(abrufe).toBe(1)

    // Nach dreissig Sekunden waeren es im lockeren Takt zwei Abrufe; im dichten
    // sind es mehr als vier.
    for (let sekunde = 0; sekunde < 6; sekunde += 1) {
      await act(() => vi.advanceTimersByTimeAsync(FRIST_INTERVALL_NAH_MS))
    }
    await waitFor(() => expect(abrufe).toBeGreaterThanOrEqual(4))
  })
})
