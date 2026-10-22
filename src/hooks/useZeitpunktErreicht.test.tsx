import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useZeitpunktErreicht } from '@/hooks/useZeitpunktErreicht'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const ZEIT = new Date(2099, 0, 13, 19, 0, 0).getTime()

describe('useZeitpunktErreicht', () => {
  test('ist vor dem Zeitpunkt falsch und wird genau zum Zeitpunkt wahr, ohne Neuladen und ohne Polling', () => {
    vi.setSystemTime(ZEIT - 10_000)
    const { result } = renderHook(() => useZeitpunktErreicht(ZEIT))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(9_999))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(true)
    // Nach dem Umschalten bleibt kein Timer zurück.
    expect(vi.getTimerCount()).toBe(0)
  })

  test('ist bei zurückliegendem Zeitpunkt sofort wahr und plant nichts', () => {
    vi.setSystemTime(ZEIT + 1)
    const { result } = renderHook(() => useZeitpunktErreicht(ZEIT))

    expect(result.current).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('ist ohne Zeitpunkt oder mit ungültigem Zeitpunkt falsch und plant nichts', () => {
    const ohne = renderHook(() => useZeitpunktErreicht(undefined))
    const ungueltig = renderHook(() => useZeitpunktErreicht(Number.NaN))

    expect(ohne.result.current).toBe(false)
    expect(ungueltig.result.current).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('räumt den Timer beim Verlassen auf', () => {
    vi.setSystemTime(ZEIT - 60_000)
    const { unmount } = renderHook(() => useZeitpunktErreicht(ZEIT))
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  test('folgt einem Wechsel des Zeitpunkts', () => {
    vi.setSystemTime(ZEIT + 5_000)
    const { result, rerender } = renderHook(({ zeit }) => useZeitpunktErreicht(zeit), { initialProps: { zeit: ZEIT } })
    expect(result.current).toBe(true)

    rerender({ zeit: ZEIT + 3_600_000 })

    expect(result.current).toBe(false)
  })

  test('plant bei sehr fernem Zeitpunkt nach, statt sofort umzuschalten', () => {
    vi.setSystemTime(ZEIT)
    const fern = ZEIT + 40 * 86_400_000
    const { result } = renderHook(() => useZeitpunktErreicht(fern))

    // Mehr als ein Timer reicht (24,8 Tage): Der Zwischenschritt löst nichts aus.
    act(() => vi.advanceTimersByTime(2 ** 31 - 1))
    expect(result.current).toBe(false)
    expect(vi.getTimerCount()).toBe(1)

    act(() => vi.advanceTimersByTime(40 * 86_400_000 - (2 ** 31 - 1)))
    expect(result.current).toBe(true)
  })
})
