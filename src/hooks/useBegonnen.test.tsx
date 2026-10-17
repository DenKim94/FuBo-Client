import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useBegonnen } from '@/hooks/useBegonnen'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const TERMIN = { datum: '2099-01-13', uhrzeit: '19:00:00' }

describe('useBegonnen', () => {
  test('ist vor dem Beginn falsch und wird zum Beginn wahr, ohne Neuladen', () => {
    vi.setSystemTime(new Date(2099, 0, 13, 18, 59, 50))
    const { result } = renderHook(() => useBegonnen(TERMIN))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(9_000))
    expect(result.current).toBe(false)

    act(() => vi.advanceTimersByTime(1_000))
    // Genau zum Beginn: die Aktionsleiste muss verschwinden.
    expect(result.current).toBe(true)
  })

  test('ist bei zurueckliegendem Beginn sofort wahr', () => {
    vi.setSystemTime(new Date(2099, 0, 13, 19, 20))
    const { result } = renderHook(() => useBegonnen(TERMIN))
    expect(result.current).toBe(true)
  })

  test('ist ohne Termin falsch und plant nichts', () => {
    const { result } = renderHook(() => useBegonnen(undefined))
    expect(result.current).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('raeumt den Timer beim Verlassen auf', () => {
    vi.setSystemTime(new Date(2099, 0, 13, 12, 0))
    const { unmount } = renderHook(() => useBegonnen(TERMIN))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('folgt einem Wechsel des Termins', () => {
    vi.setSystemTime(new Date(2099, 0, 13, 19, 5))
    const { result, rerender } = renderHook(({ termin }) => useBegonnen(termin), {
      initialProps: { termin: TERMIN },
    })
    expect(result.current).toBe(true)

    rerender({ termin: { datum: '2099-01-20', uhrzeit: '19:00:00' } })
    expect(result.current).toBe(false)
  })

  test('plant bei sehr fernem Beginn nach, statt sofort zu feuern', () => {
    vi.setSystemTime(new Date(2099, 0, 1, 12, 0))
    const { result } = renderHook(() => useBegonnen({ datum: '2099-03-01', uhrzeit: '19:00:00' }))
    expect(result.current).toBe(false)
    // Mehr als ein Timer reicht (24,8 Tage): ein Zwischenschritt darf nichts ausloesen.
    act(() => vi.advanceTimersByTime(2 ** 31 - 1))
    expect(result.current).toBe(false)
    expect(vi.getTimerCount()).toBe(1)
  })
})
