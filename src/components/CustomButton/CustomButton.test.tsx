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

  test('zeigt ein schmückendes Symbol links neben der Beschriftung', () => {
    render(<CustomButton symbol="login_icon_dark">Absenden</CustomButton>)
    const knopf = screen.getByRole('button', { name: 'Absenden' })
    const symbol = screen.getByTestId('icon-login_icon_dark')
    expect(knopf).toContainElement(symbol)
    // Links: Das Symbol ist das erste Kind, der Text folgt unmittelbar danach.
    expect(symbol.parentElement?.firstElementChild).toBe(symbol)
    expect(symbol.nextSibling?.textContent).toBe('Absenden')
    // Schmückend: Der Name besteht nur aus dem Text.
    expect(symbol).toHaveAttribute('aria-hidden', 'true')
  })

  test('zeigt ohne Symbol keines', () => {
    render(<CustomButton>Weiter</CustomButton>)
    expect(screen.queryByTestId(/^icon-/)).not.toBeInTheDocument()
  })

  test('blendet im Ladezustand Text und Symbol aus, behaelt aber den Namen', () => {
    render(
      <CustomButton laedt symbol="login_icon_dark">
        Absenden
      </CustomButton>,
    )
    const knopf = screen.getByRole('button', { name: 'Absenden' })
    // Der Inhalt liegt in einem eigenen Behaelter, der im Ladezustand unsichtbar ist.
    const inhalt = screen.getByText('Absenden')
    expect(inhalt.className).toMatch(/inhalt/)
    expect(knopf.className).toMatch(/laedt/)
    // Der Spinner steht in einem eigenen Behaelter ausserhalb des Inhalts, nicht daneben im Fluss.
    const spinner = screen.getByTestId('ladespinner')
    expect(inhalt).not.toContainElement(spinner)
    expect(spinner.parentElement?.className).toMatch(/spinner/)
  })

  test('zeigt ohne Ladezustand keinen Spinner und kein aria-busy', () => {
    render(<CustomButton>Weiter</CustomButton>)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
    expect(screen.queryByTestId('ladespinner')).not.toBeInTheDocument()
  })
})
