import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { useSperre } from './useSperre'

/** Fehler mit Wartezeit, wie ihn `aufrufen` bei `429` wirft. */
function gesperrt(wartesekunden: number | undefined, code: ApiFehler['code'] = 'PIN_GESPERRT') {
  return new ApiFehler(429, code, 'Bitte warten.', wartesekunden)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSperre', () => {
  test('ist anfangs nicht aktiv', () => {
    const { result } = renderHook(() => useSperre())
    expect(result.current.aktiv).toBe(false)
  })

  test('sperrt fuer die Wartezeit des Servers und ruft danach beimEnde', () => {
    const beimEnde = vi.fn()
    const { result } = renderHook(() => useSperre({ beimEnde }))

    act(() => result.current.ausFehler(gesperrt(30)))
    expect(result.current.aktiv).toBe(true)

    // Kurz vor dem Ende ist noch gesperrt und nichts gerufen ...
    act(() => vi.advanceTimersByTime(29_999))
    expect(result.current.aktiv).toBe(true)
    expect(beimEnde).not.toHaveBeenCalled()

    // ... mit dem Ende ist die Sperre weg, und der Rueckruf lief genau einmal.
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.aktiv).toBe(false)
    expect(beimEnde).toHaveBeenCalledOnce()
  })

  test('gilt fuer jede gedrosselte Antwort, nicht nur fuer PIN_GESPERRT', () => {
    // RESET_GEDROSSELT (Anforderung der Bestaetigungs-PIN) traegt ebenfalls wartesekunden.
    const { result } = renderHook(() => useSperre())
    act(() => result.current.ausFehler(gesperrt(10, 'RESET_GEDROSSELT')))
    expect(result.current.aktiv).toBe(true)
  })

  test.each([
    ['ein anderer Status', new ApiFehler(401, 'PIN_FALSCH', 'Falsch.', 30)],
    ['ein 429 ohne Wartezeit', gesperrt(undefined)],
    ['ein Netzfehler', new TypeError('Failed to fetch')],
    ['kein Fehlerobjekt', 'unbekannt'],
  ])('bleibt bei %s ohne Wirkung', (_name, fehler) => {
    const { result } = renderHook(() => useSperre())
    act(() => result.current.ausFehler(fehler))
    expect(result.current.aktiv).toBe(false)
  })

  test('setzt den Zeitgeber bei einer neuen Sperre neu', () => {
    const beimEnde = vi.fn()
    const { result } = renderHook(() => useSperre({ beimEnde }))

    act(() => result.current.ausFehler(gesperrt(10)))
    act(() => vi.advanceTimersByTime(5_000))
    act(() => result.current.ausFehler(gesperrt(10)))

    // Die erste Sperre waere jetzt vorbei; die zweite laeuft noch fuenf Sekunden.
    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.aktiv).toBe(true)
    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.aktiv).toBe(false)
    expect(beimEnde).toHaveBeenCalledOnce()
  })

  test('behaelt den Zeitgeber, wenn beimEnde bei jedem Render neu entsteht', () => {
    // Ein Aufrufer, der eine Pfeilfunktion einsetzt, darf die Sperre nicht verlaengern.
    const aufrufe: number[] = []
    const { result, rerender } = renderHook(() => useSperre({ beimEnde: () => aufrufe.push(1) }))

    act(() => result.current.ausFehler(gesperrt(10)))
    act(() => vi.advanceTimersByTime(6_000))
    rerender()
    act(() => vi.advanceTimersByTime(4_000))

    expect(result.current.aktiv).toBe(false)
    expect(aufrufe).toHaveLength(1)
  })

  test('raeumt den Zeitgeber beim Entfernen auf', () => {
    const beimEnde = vi.fn()
    const { result, unmount } = renderHook(() => useSperre({ beimEnde }))
    act(() => result.current.ausFehler(gesperrt(10)))

    unmount()
    act(() => vi.advanceTimersByTime(20_000))

    expect(beimEnde).not.toHaveBeenCalled()
  })
})
