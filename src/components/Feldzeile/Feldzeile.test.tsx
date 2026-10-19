import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Feldzeile from './Feldzeile'

describe('Feldzeile', () => {
  test('zeigt ihre Kinder und trägt die Test-ID', () => {
    render(
      <Feldzeile data-testid="zeile">
        <span>Links</span>
        <span>Rechts</span>
      </Feldzeile>,
    )

    expect(screen.getByTestId('zeile')).toHaveTextContent('LinksRechts')
  })

  test('hat zwei gleich breite Spalten, wenn nichts anderes gesagt wird', () => {
    render(<Feldzeile data-testid="zeile">x</Feldzeile>)

    expect(screen.getByTestId('zeile').style.gridTemplateColumns).toBe('1fr 1fr')
  })

  test('übernimmt die Spaltenbreiten des Aufrufers', () => {
    render(
      <Feldzeile spalten="1fr 7.5rem" data-testid="zeile">
        x
      </Feldzeile>,
    )

    expect(screen.getByTestId('zeile').style.gridTemplateColumns).toBe('1fr 7.5rem')
  })

  test('gestapelt: eine Spalte, egal welche Breiten gesetzt sind', () => {
    render(
      <Feldzeile spalten="1fr 7.5rem" gestapelt data-testid="zeile">
        x
      </Feldzeile>,
    )

    expect(screen.getByTestId('zeile').style.gridTemplateColumns).toBe('1fr')
  })
})
