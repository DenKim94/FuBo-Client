import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { verbindungMelden } from '@/api/verbindungsStatus'
import OfflineHinweis from './OfflineHinweis'

/** Setzt `navigator.onLine` fuer die Dauer eines Tests. */
function netzzustandSetzen(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { value: online, configurable: true })
}

// In `act`, weil der Zustand global ist und die Komponente des vorigen Tests zu
// diesem Zeitpunkt noch haengt: Das Zuruecksetzen loest sonst ein Rendern
// ausserhalb der Testumgebung aus.
afterEach(() => {
  act(() => {
    netzzustandSetzen(true)
    verbindungMelden(true)
  })
})

describe('OfflineHinweis', () => {
  test('bleibt unsichtbar, solange der Server erreichbar ist', () => {
    render(<OfflineHinweis />)
    expect(screen.queryByTestId('offline-hinweis')).not.toBeInTheDocument()
  })

  test('erscheint, sobald der Browser kein Netz sieht', () => {
    netzzustandSetzen(false)
    render(<OfflineHinweis />)

    const hinweis = screen.getByTestId('offline-hinweis')
    expect(hinweis).toBeInTheDocument()
    // `role="status"` meldet den Zustand dem Screenreader, ohne den Fokus zu
    // verschieben.
    expect(hinweis).toHaveAttribute('role', 'status')
  })

  test('erscheint auch, wenn der Browser ein Netz sieht, ein Aufruf aber ohne Antwort blieb', () => {
    // Der Alltagsfall am Sportplatz: WLAN verbunden, aber kein Weg ins
    // Internet. `navigator.onLine` meldet dabei `true`.
    render(<OfflineHinweis />)
    expect(screen.queryByTestId('offline-hinweis')).not.toBeInTheDocument()

    act(() => verbindungMelden(false))

    expect(screen.getByTestId('offline-hinweis')).toBeInTheDocument()
  })

  test('verschwindet wieder, sobald ein Aufruf eine Antwort bekommt', () => {
    render(<OfflineHinweis />)
    act(() => verbindungMelden(false))
    expect(screen.getByTestId('offline-hinweis')).toBeInTheDocument()

    act(() => verbindungMelden(true))

    expect(screen.queryByTestId('offline-hinweis')).not.toBeInTheDocument()
  })
})
