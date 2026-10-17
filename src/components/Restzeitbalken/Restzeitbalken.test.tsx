import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Restzeitbalken from './Restzeitbalken'

const MINUTE = 60_000

/** Füllstand in Prozent (CSS-Variable am Füllelement). */
function fuellung() {
  return screen.getByTestId('restzeitbalken-fuellung').style.getPropertyValue('--fuellung-anteil')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-17T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Restzeitbalken', () => {
  test('beginnt voll und ist reiner Schmuck', () => {
    render(<Restzeitbalken ende={Date.now() + 15 * MINUTE} dauer={15 * MINUTE} />)
    expect(fuellung()).toBe('100%')
    // Die Aussage steht im Satz daneben, nicht im Balken.
    expect(screen.getByTestId('restzeitbalken')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  test('schrumpft mit der Zeit', () => {
    render(<Restzeitbalken ende={Date.now() + 15 * MINUTE} dauer={15 * MINUTE} />)

    act(() => vi.advanceTimersByTime(7.5 * MINUTE))

    expect(fuellung()).toBe('50%')
  })

  test('bleibt nach Ablauf bei null und wird nie negativ', () => {
    render(<Restzeitbalken ende={Date.now() + MINUTE} dauer={15 * MINUTE} />)

    act(() => vi.advanceTimersByTime(30 * MINUTE))

    expect(fuellung()).toBe('0%')
  })

  test('deckelt bei hundert Prozent, wenn das Ende weiter entfernt ist als die Dauer', () => {
    render(<Restzeitbalken ende={Date.now() + 60 * MINUTE} dauer={15 * MINUTE} />)
    expect(fuellung()).toBe('100%')
  })

  test('raeumt den Zeitgeber beim Entfernen auf', () => {
    const { unmount } = render(<Restzeitbalken ende={Date.now() + MINUTE} dauer={MINUTE} />)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
