import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { beispielErgebnis } from '@/test/mocks/termine'
import ErgebnisAnzeige from './ErgebnisAnzeige'

describe('ErgebnisAnzeige', () => {
  test('nennt den Sieger, den deutlichen Sieg im Satz und die Erfassung', () => {
    render(<ErgebnisAnzeige ergebnis={beispielErgebnis} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Ergebnis' })).toBeInTheDocument()
    expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent('Team A hat deutlich gewonnen.')
    expect(screen.getByTestId('ergebnis-anzeige-erfasst')).toHaveTextContent('Erfasst von Beispielspieler 01 am ')
    expect(screen.queryByTestId('ergebnis-anzeige-korrigiert')).not.toBeInTheDocument()
  })

  test('zeigt einen knappen Sieg ohne „deutlich“', () => {
    render(<ErgebnisAnzeige ergebnis={{ ...beispielErgebnis, sieger: 'B', deutlich: false }} />)
    expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent(/^Team B hat gewonnen\.$/)
  })

  test('zeigt ein Unentschieden ohne Sieger', () => {
    render(<ErgebnisAnzeige ergebnis={{ ...beispielErgebnis, sieger: 'U', deutlich: false }} />)
    expect(screen.getByTestId('ergebnis-anzeige-satz')).toHaveTextContent(/^Unentschieden\.$/)
  })

  test('nennt die Korrektur des Admins, wenn es eine gab', () => {
    render(<ErgebnisAnzeige ergebnis={{ ...beispielErgebnis, korrigiertAm: '2099-01-14T08:00:00Z', version: 2 }} />)
    expect(screen.getByTestId('ergebnis-anzeige-korrigiert')).toHaveTextContent('Zuletzt korrigiert am ')
  })

  test('bietet keine Bearbeitung an', () => {
    render(<ErgebnisAnzeige ergebnis={beispielErgebnis} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  test('traegt eine Ueberschrift, die sich fokussieren laesst', () => {
    render(<ErgebnisAnzeige ergebnis={beispielErgebnis} />)
    const titel = screen.getByTestId('ergebnis-anzeige-titel')
    titel.focus()
    expect(titel).toHaveFocus()
  })
})
