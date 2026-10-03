import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import CustomButton from './CustomButton'

describe('CustomButton', () => {
  test('ist ohne Angabe kein Absenden-Knopf', () => {
    // Sonst schickte ein „Abbrechen" im Formular das Formular ab.
    render(<CustomButton>Abbrechen</CustomButton>)
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveAttribute('type', 'button')
  })

  test('uebernimmt type, data-testid und weitere Attribute', () => {
    render(
      <CustomButton type="submit" data-testid="pin-absenden" aria-describedby="hinweis">
        Zutritt
      </CustomButton>,
    )
    const knopf = screen.getByTestId('pin-absenden')
    expect(knopf).toHaveAttribute('type', 'submit')
    expect(knopf).toHaveAttribute('aria-describedby', 'hinweis')
  })

  test('sperrt im Ladezustand, meldet ihn und behaelt den Namen', () => {
    const klick = vi.fn()
    render(
      <CustomButton laedt onClick={klick}>
        Zutritt
      </CustomButton>,
    )
    // Der Spinner ist Schmuck: Der Name bleibt „Zutritt", nicht „Wird geladen Zutritt".
    const knopf = screen.getByRole('button', { name: 'Zutritt' })
    expect(knopf).toBeDisabled()
    expect(knopf).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('ladespinner')).toBeInTheDocument()

    fireEvent.click(knopf)
    expect(klick).not.toHaveBeenCalled()
  })

  test('zeigt ohne Ladezustand keinen Spinner und kein aria-busy', () => {
    render(<CustomButton>Weiter</CustomButton>)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
    expect(screen.queryByTestId('ladespinner')).not.toBeInTheDocument()
  })
})
