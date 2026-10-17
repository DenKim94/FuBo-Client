import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Zusagestatus from './Zusagestatus'

describe('Zusagestatus', () => {
  test('zeigt bei true die Zusage', () => {
    render(<Zusagestatus rueckmeldung={true} />)
    expect(screen.getByTestId('zusagestatus')).toHaveAttribute('data-zustand', 'zugesagt')
    expect(screen.getByText('Du hast zugesagt.')).toBeInTheDocument()
  })

  test('zeigt bei false die Absage', () => {
    render(<Zusagestatus rueckmeldung={false} />)
    expect(screen.getByTestId('zusagestatus')).toHaveAttribute('data-zustand', 'abgesagt')
    expect(screen.getByText('Du hast abgesagt.')).toBeInTheDocument()
  })

  test('behandelt null als „noch nicht gemeldet“ und nicht als Absage', () => {
    // Ein `if (rueckmeldung)` machte aus null eine Absage; dieser Fall haelt den
    // dritten Zustand fest.
    render(<Zusagestatus rueckmeldung={null} />)
    const status = screen.getByTestId('zusagestatus')
    expect(status).toHaveAttribute('data-zustand', 'offen')
    expect(screen.getByText('Noch nicht gemeldet.')).toBeInTheDocument()
    expect(screen.getByText('Bitte melde dich bis zum Beginn.')).toBeInTheDocument()
    expect(screen.queryByText('Du hast abgesagt.')).not.toBeInTheDocument()
  })

  test('nennt auf der Warteschlange den Platz', () => {
    render(<Zusagestatus rueckmeldung={true} wartet warteplatz={2} />)
    expect(
      screen.getByText('Du hast zugesagt und stehst auf der Warteschlange (Platz 2).'),
    ).toBeInTheDocument()
  })

  test('ignoriert wartet bei einer Absage', () => {
    render(<Zusagestatus rueckmeldung={false} wartet warteplatz={2} />)
    expect(screen.queryByText(/Warteschlange/)).not.toBeInTheDocument()
  })

  test('ist eine Live-Region, in der kompakten Form nicht', () => {
    const { rerender } = render(<Zusagestatus rueckmeldung={true} />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(<Zusagestatus rueckmeldung={true} kompakt />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('laesst den Zusatzsatz in der kompakten Form weg', () => {
    render(<Zusagestatus rueckmeldung={null} kompakt />)
    expect(screen.getByText('Noch nicht gemeldet.')).toBeInTheDocument()
    expect(screen.queryByText('Bitte melde dich bis zum Beginn.')).not.toBeInTheDocument()
  })
})
