import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Fortschrittsbalken from './Fortschrittsbalken'

describe('Fortschrittsbalken', () => {
  test('nennt die Zahlen im Text und in aria-valuetext, unabhaengig von der Farbe', () => {
    render(<Fortschrittsbalken wert={4} ziel={6} erreicht={false} />)

    const balken = screen.getByRole('progressbar', { name: 'Zusagen' })
    expect(balken).toHaveAttribute('aria-valuenow', '4')
    expect(balken).toHaveAttribute('aria-valuemax', '6')
    expect(balken).toHaveAttribute('aria-valuetext', '4 von 6 Zusagen')
    // Die Aussage „zu wenige“ steht als Text da, nicht nur als rote Fuellung.
    expect(screen.getByTestId('fortschrittsbalken-text')).toHaveTextContent(
      '4 von 6 Zusagen – Mindestanzahl noch nicht erreicht',
    )
  })

  test('folgt beim Zustand dem Server und nicht der eigenen Rechnung', () => {
    // 5 von 6 – der Server meldet trotzdem „erreicht“ (z. B. geaenderte Konfiguration).
    render(<Fortschrittsbalken wert={5} ziel={6} erreicht />)

    expect(screen.getByTestId('fortschrittsbalken-fuellung')).toHaveAttribute('data-erreicht', 'true')
    expect(screen.getByTestId('fortschrittsbalken-text')).not.toHaveTextContent('Mindestanzahl')
  })

  test('deckelt die Fuellung bei 100 Prozent, zeigt aber die echte Zahl', () => {
    render(<Fortschrittsbalken wert={9} ziel={6} erreicht />)

    expect(screen.getByTestId('fortschrittsbalken-fuellung').style.getPropertyValue('--fuellung-anteil')).toBe(
      '100%',
    )
    expect(screen.getByTestId('fortschrittsbalken-text')).toHaveTextContent('9 von 6 Zusagen')
  })

  test('verkraftet eine Mindestanzahl von null', () => {
    render(<Fortschrittsbalken wert={0} ziel={0} erreicht />)
    expect(screen.getByTestId('fortschrittsbalken-fuellung').style.getPropertyValue('--fuellung-anteil')).toBe('0%')
  })
})
