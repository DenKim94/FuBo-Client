import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Feld from './Feld'

describe('Feld', () => {
  test('verknuepft Beschriftung und Hinweis mit dem Feld', () => {
    render(<Feld beschriftung="Dein Name" hinweis="2 bis 40 Zeichen." />)
    const feld = screen.getByLabelText('Dein Name')
    expect(feld).toHaveAccessibleDescription('2 bis 40 Zeichen.')
    expect(feld).not.toHaveAttribute('aria-invalid')
  })

  test('meldet einen Fehler auch ohne Farbe', () => {
    render(<Feld beschriftung="Dein Name" hinweis="2 bis 40 Zeichen." fehler="Name vergeben." />)
    const feld = screen.getByLabelText('Dein Name')
    // Der rote Rahmen sagt es nur den Sehenden; aria-invalid und die
    // Beschreibung sagen es allen.
    expect(feld).toHaveAttribute('aria-invalid', 'true')
    expect(feld).toHaveAccessibleDescription('2 bis 40 Zeichen. Name vergeben.')
  })

  test('uebernimmt data-testid und Attribute des Eingabeelements', () => {
    render(<Feld beschriftung="Name" data-testid="gast-name" maxLength={40} />)
    expect(screen.getByTestId('gast-name')).toHaveAttribute('maxlength', '40')
  })
})
