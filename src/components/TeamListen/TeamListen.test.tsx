import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { TeamEintrag } from '@/api/teams/teams'
import TeamListen from './TeamListen'

const A: TeamEintrag[] = [
  { anzeigeName: 'Beispielspieler 11', gast: false, auswechselspieler: false },
  { anzeigeName: 'Beispielspieler 13', gast: false, auswechselspieler: true },
]
const B: TeamEintrag[] = [{ anzeigeName: 'Beispielgast', gast: true, auswechselspieler: false }]

describe('TeamListen', () => {
  test('zeigt zwei Teams als h3 mit Zahl, die den Auswechselspieler mitzählt, in der gelieferten Reihenfolge', () => {
    render(<TeamListen teamA={A} teamB={B} />)

    expect(screen.getByRole('heading', { level: 3, name: 'Team A (2)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Team B (1)' })).toBeInTheDocument()
    const namen = within(screen.getByTestId('team-listen-a')).getAllByRole('listitem')
    expect(namen[0]).toHaveTextContent('Beispielspieler 11')
    expect(namen[1]).toHaveTextContent('Beispielspieler 13')
  })

  test('kennzeichnet Gäste mit Text und den Auswechselspieler genau einmal als Text', () => {
    render(<TeamListen teamA={A} teamB={B} />)

    expect(within(screen.getByTestId('team-listen-b')).getByText(/Beispielgast \(Gast\)/)).toBeInTheDocument()
    expect(screen.getAllByTestId('team-listen-auswechselspieler')).toHaveLength(1)
    expect(screen.getByTestId('team-listen-auswechselspieler')).toHaveTextContent('Auswechselspieler')
  })

  test('markiert den eigenen Eintrag nur bei gleichem Namen und gleicher Art; ohne Angabe gibt es kein „(du)“', () => {
    const { rerender } = render(<TeamListen teamA={A} teamB={B} eigenerName="Beispielspieler 11" eigenerGast={false} />)
    expect(screen.getByText(/Beispielspieler 11 \(du\)/)).toBeInTheDocument()

    // Ein Gast, der so heißt wie ein Profil, ist nicht „du“.
    rerender(<TeamListen teamA={A} teamB={B} eigenerName="Beispielspieler 11" eigenerGast />)
    expect(screen.queryByText(/\(du\)/)).not.toBeInTheDocument()

    rerender(<TeamListen teamA={A} teamB={B} />)
    expect(screen.queryByText(/\(du\)/)).not.toBeInTheDocument()
  })

  test('der Präfix der Test-IDs ist wählbar', () => {
    render(<TeamListen teamA={A} teamB={B} data-testid="admin-teams-ergebnis-teams" />)

    expect(screen.getByTestId('admin-teams-ergebnis-teams-a')).toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-ergebnis-teams-b')).toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-ergebnis-teams-auswechselspieler')).toBeInTheDocument()
  })

  test('zeigt keine Skillwerte und keine Stufe', () => {
    render(<TeamListen teamA={A} teamB={B} />)

    expect(screen.queryByText(/skill|stufe|stark|schwach/i)).not.toBeInTheDocument()
  })
})
