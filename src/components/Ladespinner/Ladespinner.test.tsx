import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Ladespinner from './Ladespinner'

describe('Ladespinner', () => {
  test('meldet den Ladezustand an Screenreader', () => {
    render(<Ladespinner />)
    // Die Drehung allein ist fuer einen blinden Nutzer keine Aussage.
    expect(screen.getByRole('status')).toHaveTextContent('Wird geladen')
  })

  test('zeigt einen sichtbaren Text an, wenn einer uebergeben wird', () => {
    render(<Ladespinner text="Teams werden erstellt" />)
    expect(screen.getByRole('status')).toHaveTextContent('Teams werden erstellt')
    expect(screen.queryByText('Wird geladen')).not.toBeInTheDocument()
  })

  test('bleibt als Schmuck ohne Rolle und fuer Screenreader verborgen', () => {
    // In einer Schaltflaeche ginge „Wird geladen" sonst in ihren Namen ein.
    render(<Ladespinner dekorativ />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByTestId('ladespinner')).toHaveAttribute('aria-hidden', 'true')
  })
})
