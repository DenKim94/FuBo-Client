import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
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

  test('reicht ref an das Button-Element durch', () => {
    // Der Aufrufer setzt damit den Fokus, wenn die gedrückte Schaltfläche entfällt.
    const ref = createRef<HTMLButtonElement>()
    render(<CustomButton ref={ref}>Absagen</CustomButton>)
    expect(ref.current).toBe(screen.getByRole('button', { name: 'Absagen' }))
  })

  test('bleibt mit aria-disabled fokussierbar und meldet den Zustand', () => {
    render(<CustomButton aria-disabled="true">Teams generieren</CustomButton>)
    const knopf = screen.getByRole('button', { name: 'Teams generieren' })
    // Nicht `disabled`: Sonst verlöre das Element den Fokus und fehlte in der Tabulatorreihenfolge.
    expect(knopf).not.toBeDisabled()
    knopf.focus()
    expect(knopf).toHaveFocus()
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
  })

  test('„gefahrUmriss“ ist eine eigene Art, nicht die der vollen Gefahr-Schaltfläche', () => {
    render(
      <>
        <CustomButton art="gefahrUmriss" data-testid="umriss">
          Entfernen
        </CustomButton>
        <CustomButton art="gefahr" data-testid="voll">
          Absagen
        </CustomButton>
      </>,
    )

    expect(screen.getByTestId('umriss').className).toMatch(/gefahrUmriss/)
    expect(screen.getByTestId('voll').className).not.toMatch(/gefahrUmriss/)
    expect(screen.getByTestId('umriss')).toHaveAttribute('type', 'button')
  })

  test('„akzent“ ist eine eigene Art (blau), ohne Inline-Farbe', () => {
    render(
      <CustomButton art="akzent" data-testid="akzent">
        Termin abschließen
      </CustomButton>,
    )

    const knopf = screen.getByTestId('akzent')
    expect(knopf.className).toMatch(/akzent/)
    expect(knopf.className).not.toMatch(/primaer|sekundaer|gefahr/)
    expect(knopf).not.toHaveAttribute('style')
  })
})
