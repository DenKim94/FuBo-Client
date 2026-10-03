import { QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, delay, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { usePinPruefen } from '@/hooks/usePinPruefen'
import { useSitzung } from '@/hooks/useSitzung'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'

/**
 * Stellt den Query-Client der Anwendung bereit.
 *
 * Bewusst der echte und kein eigens erzeugter: Nur so laufen die globale
 * 401-Behandlung und die Wiederholungsregel mit, die dieser Hook voraussetzt.
 */
function Umgebung({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

/** Ein Render: Stand der Mutation und der Sitzung zum selben Zeitpunkt. */
type Momentaufnahme = { erfolg: boolean; pinGeprueft: boolean }

/**
 * Rendert den Hook zusammen mit `useSitzung`, wie es die Anmeldeseite tut.
 *
 * Hält jeden Render im Verlauf fest. TanStack Query meldet Zustandswechsel
 * gebündelt über einen eigenen Zeitgeber; eine Aussage über die Reihenfolge
 * zweier Zustände lässt sich deshalb nur am Verlauf prüfen, nicht an einer
 * einzelnen Momentaufnahme nach `act`.
 */
function rendern() {
  const verlauf: Momentaufnahme[] = []
  const ergebnis = renderHook(
    () => {
      const werte = { pin: usePinPruefen(), sitzung: useSitzung() }
      verlauf.push({ erfolg: werte.pin.isSuccess, pinGeprueft: werte.sitzung.pinGeprueft })
      return werte
    },
    { wrapper: Umgebung },
  )
  return { ...ergebnis, verlauf }
}

/** Künstliche Antwortzeiten des Sitzungsabrufs in Millisekunden. */
type Verzoegerung = {
  /** Der erste Abruf antwortet erst danach – mit dem Stand von davor. */
  ersterAbruf?: number
  /** Jeder spätere Abruf, also das Neulesen nach der PIN-Prüfung. */
  neulesen?: number
}

/**
 * Bildet den Server ab: ohne Sitzung vor der PIN-Prüfung, `PIN_VERIFIED` danach.
 *
 * @param verzoegerung Optionale Antwortzeiten, um Überschneidungen zu erzeugen.
 * @returns Zähler, wie oft die Sitzung gelesen wurde.
 */
function serverMitSitzungswechsel(verzoegerung: Verzoegerung = {}) {
  const zaehler = { sitzungLesen: 0 }
  let pinGeprueft = false
  mockServer.use(
    http.get('*/auth/session/lesen', async () => {
      zaehler.sitzungLesen += 1
      // Den Stand beim Eingang der Anfrage festhalten, nicht beim Antworten.
      const stand = pinGeprueft
      const ms = zaehler.sitzungLesen === 1 ? verzoegerung.ersterAbruf : verzoegerung.neulesen
      if (ms) await delay(ms)
      return stand
        ? HttpResponse.json({ stage: 'PIN_VERIFIED' })
        : problem(401, 'SESSION_UNGUELTIG', 'Keine Sitzung.')
    }),
    http.post('*/auth/pin/pruefen', () => {
      pinGeprueft = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return zaehler
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('usePinPruefen', () => {
  test('meldet Erfolg erst, wenn die neue Sitzung gelesen ist', async () => {
    // Das Neulesen dauert spuerbar; ohne das Warten im Hook entstuende genau
    // in dieser Zeit ein Render mit „fertig, aber noch nicht angemeldet".
    serverMitSitzungswechsel({ neulesen: 50 })
    const { result, verlauf } = rendern()
    await waitFor(() => expect(result.current.sitzung.laedt).toBe(false))

    act(() => result.current.pin.mutate('1234'))
    await waitFor(() => expect(result.current.pin.isSuccess).toBe(true))

    expect(result.current.sitzung.pinGeprueft).toBe(true)
    // Kein einziger Render, in dem die Mutation schon fertig ist, die Sitzung
    // aber noch den alten Stand zeigt.
    expect(verlauf.filter((m) => m.erfolg && !m.pinGeprueft)).toEqual([])
  })

  test('entfernt bei Erfolg die Daten einer frueheren Identitaet', async () => {
    serverMitSitzungswechsel()
    const { result } = rendern()
    await waitFor(() => expect(result.current.sitzung.laedt).toBe(false))
    queryClient.setQueryData(schluessel.bilanz, { siege: 3 })

    await act(() => result.current.pin.mutateAsync('1234'))

    expect(queryClient.getQueryData(schluessel.bilanz)).toBeUndefined()
    expect(queryClient.getQueryData(schluessel.sitzung)).toEqual({ stage: 'PIN_VERIFIED' })
  })

  test('verwirft einen Sitzungsabruf, der vor der PIN-Pruefung gestellt wurde', async () => {
    // Langsames Netz beim ersten Laden: Die PIN ist abgeschickt, bevor die
    // erste Sitzungsantwort da ist. Diese Antwort zeigt den Stand von davor.
    serverMitSitzungswechsel({ ersterAbruf: 100 })
    const { result } = rendern()
    expect(result.current.sitzung.laedt).toBe(true)

    await act(() => result.current.pin.mutateAsync('1234'))

    expect(queryClient.getQueryData(schluessel.sitzung)).toEqual({ stage: 'PIN_VERIFIED' })
    await waitFor(() => expect(result.current.sitzung.pinGeprueft).toBe(true))
  })

  test('liefert bei falscher PIN den ApiFehler und meldet kein Sitzungsende', async () => {
    const zaehler = serverMitSitzungswechsel()
    mockServer.use(
      http.post('*/auth/pin/pruefen', () =>
        problem(401, 'PIN_FALSCH', 'Die PIN ist nicht korrekt.'),
      ),
    )
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    const { result } = rendern()
    await waitFor(() => expect(result.current.sitzung.laedt).toBe(false))
    const gelesenVorher = zaehler.sitzungLesen

    act(() => result.current.pin.mutate('9999'))
    await waitFor(() => expect(result.current.pin.isError).toBe(true))

    const fehler = result.current.pin.error
    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe('PIN_FALSCH')
    expect(fehler?.message).toBe('Die PIN ist nicht korrekt.')
    // Eine vertippte PIN ist kein Sitzungsablauf (queryClient.ts).
    expect(abmelden).not.toHaveBeenCalled()
    // Ohne Erfolg gibt es keinen Grund, die Sitzung neu zu lesen.
    expect(zaehler.sitzungLesen).toBe(gelesenVorher)
  })

  test('wiederholt bei Sperre nicht und reicht die Wartezeit durch', async () => {
    let versuche = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => problem(401, 'SESSION_UNGUELTIG', 'Keine Sitzung.')),
      http.post('*/auth/pin/pruefen', () => {
        versuche += 1
        return HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'PIN_GESPERRT',
            detail: 'Zu viele Fehlversuche. Bitte in 58 Sekunden erneut versuchen.',
            wartesekunden: 58,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }),
    )
    const { result } = rendern()

    act(() => result.current.pin.mutate('9999'))
    await waitFor(() => expect(result.current.pin.isError).toBe(true))

    // Ein zweiter Versuch verlaengerte die Sperre.
    expect(versuche).toBe(1)
    expect((result.current.pin.error as ApiFehler).wartesekunden).toBe(58)
  })
})
