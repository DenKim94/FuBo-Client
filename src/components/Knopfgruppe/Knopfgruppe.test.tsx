import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Knopfgruppe from './Knopfgruppe'

describe('Knopfgruppe', () => {
  test('setzt die Schaltflächen nebeneinander in gleich breite Spalten', () => {
    render(
      <Knopfgruppe data-testid="gruppe">
        <button type="button">Abbrechen</button>
        <button type="button">Speichern</button>
      </Knopfgruppe>,
    )
    const gruppe = screen.getByTestId('gruppe')
    expect(gruppe.className).toMatch(/nebeneinander/)
    expect(gruppe.className).not.toMatch(/untereinander/)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  test('setzt die Schaltflächen auf Wunsch untereinander', () => {
    render(
      <Knopfgruppe untereinander data-testid="gruppe">
        <button type="button">Bestätigen</button>
        <button type="button">Abbrechen</button>
      </Knopfgruppe>,
    )
    expect(screen.getByTestId('gruppe').className).toMatch(/untereinander/)
  })

  test('übernimmt die Klasse des Aufrufers', () => {
    render(
      <Knopfgruppe className="eigene" data-testid="gruppe">
        <button type="button">Eins</button>
      </Knopfgruppe>,
    )
    expect(screen.getByTestId('gruppe')).toHaveClass('eigene')
  })

  test('bedingte Schaltflächen, die fehlen, erzeugen keine leeren Elemente', () => {
    const zeigen = false
    render(
      <Knopfgruppe data-testid="gruppe">
        {zeigen && <button type="button">Versteckt</button>}
        <button type="button">Sichtbar</button>
      </Knopfgruppe>,
    )
    expect(screen.getByTestId('gruppe').children).toHaveLength(1)
  })
})
