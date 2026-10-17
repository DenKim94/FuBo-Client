import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import PasswortRegeln from './PasswortRegeln'

describe('PasswortRegeln', () => {
  test('nennt die Mindestlaenge als offene Regel, solange das Passwort kurz ist', () => {
    render(<PasswortRegeln passwort="kurz" />)
    const regel = screen.getByTestId('passwort-regeln-mindestens')
    expect(regel).toHaveTextContent('mindestens 10 Zeichen')
    expect(regel).toHaveAttribute('data-erfuellt', 'false')
    // Nicht nur Farbe: Das Symbol hat einen Namen fuer Screenreader.
    expect(within(regel).getByRole('img', { name: 'Noch offen:' })).toBeInTheDocument()
  })

  test('markiert die Regel ab zehn Zeichen als erfuellt – mit Symbol und Text', () => {
    render(<PasswortRegeln passwort={'a'.repeat(10)} />)
    const regel = screen.getByTestId('passwort-regeln-mindestens')
    expect(regel).toHaveAttribute('data-erfuellt', 'true')
    expect(within(regel).getByRole('img', { name: 'Erfüllt:' })).toBeInTheDocument()
    expect(screen.getByTestId('icon-check_circle_icon')).toBeInTheDocument()
  })

  test('unterscheidet erfuellt und offen durch die Form des Symbols', () => {
    const { rerender } = render(<PasswortRegeln passwort="" />)
    expect(screen.getByTestId('icon-cancel_circle_icon_dark')).toBeInTheDocument()
    rerender(<PasswortRegeln passwort={'a'.repeat(10)} />)
    expect(screen.getByTestId('icon-check_circle_icon')).toBeInTheDocument()
    expect(screen.queryByTestId('icon-cancel_circle_icon_dark')).not.toBeInTheDocument()
  })

  test('zeigt die Hoechstlaenge erst, wenn sie ueberschritten ist', () => {
    const { rerender } = render(<PasswortRegeln passwort={'a'.repeat(72)} />)
    expect(screen.queryByTestId('passwort-regeln-hoechstens')).not.toBeInTheDocument()

    rerender(<PasswortRegeln passwort={'a'.repeat(73)} />)
    expect(screen.getByTestId('passwort-regeln-hoechstens')).toHaveTextContent('höchstens 72 Zeichen')
    expect(screen.getByTestId('passwort-regeln-hoechstens')).toHaveAttribute('data-erfuellt', 'false')
  })

  test('kennt keine Regel zu Zeichenklassen', () => {
    // „Ziffer enthalten“ aus dem Prototyp entfaellt: Der Kontrakt verlangt sie nicht.
    render(<PasswortRegeln passwort="abc" />)
    expect(screen.queryByText(/Ziffer/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  test('traegt keine Live-Region', () => {
    // Sonst wuerde bei jedem Zeichen vorgelesen.
    render(<PasswortRegeln passwort="abc" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('passwort-regeln')).not.toHaveAttribute('aria-live')
  })
})
