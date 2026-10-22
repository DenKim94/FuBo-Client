import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import StufeWahl from './StufeWahl'

describe('StufeWahl', () => {
  test('ist eine Radiogruppe mit den drei Stufen in der Reihenfolge stark, mittel, schwach', () => {
    render(<StufeWahl legende="Stufe" wert={null} beiAenderung={() => {}} />)
    const gruppe = screen.getByRole('group', { name: 'Stufe' })
    expect(gruppe).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('data-testid'))).toEqual([
      'stufe-wahl-STARK',
      'stufe-wahl-MITTEL',
      'stufe-wahl-SCHWACH',
    ])
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).labels?.[0].textContent)).toEqual([
      'Stark',
      'Mittel',
      'Schwach',
    ])
  })

  test('hat ohne Wert keine Vorauswahl (Pflichtwahl)', () => {
    render(<StufeWahl legende="Stufe" wert={null} beiAenderung={() => {}} />)
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked()
  })

  test('zeigt den gewaehlten Wert und meldet eine neue Wahl als Vertragswert', () => {
    const beiAenderung = vi.fn()
    render(<StufeWahl legende="Stufe" wert="MITTEL" beiAenderung={beiAenderung} />)
    expect(screen.getByTestId('stufe-wahl-MITTEL')).toBeChecked()
    fireEvent.click(screen.getByTestId('stufe-wahl-SCHWACH'))
    expect(beiAenderung).toHaveBeenCalledWith('SCHWACH')
  })

  test('nimmt waehrend des Sendens keine Wahl an', () => {
    const beiAenderung = vi.fn()
    render(<StufeWahl legende="Stufe" wert="STARK" beiAenderung={beiAenderung} schreibgeschuetzt />)
    fireEvent.click(screen.getByTestId('stufe-wahl-SCHWACH'))
    expect(beiAenderung).not.toHaveBeenCalled()
  })

  test('uebernimmt Hinweis und Test-ID', () => {
    render(<StufeWahl legende="Stufe" wert={null} beiAenderung={() => {}} hinweis="Pflicht." data-testid="gast-stufe" />)
    expect(screen.getByRole('group', { name: 'Stufe' })).toHaveAccessibleDescription('Pflicht.')
    expect(screen.getByTestId('gast-stufe-STARK')).toBeInTheDocument()
  })
})
