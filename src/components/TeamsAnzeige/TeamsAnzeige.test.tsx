import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { Teameinteilung } from '@/api/teams/teams'
import { EIGENER_NAME } from '@/test/mocks/termine'
import TeamsAnzeige from './TeamsAnzeige'

function einteilung(teil: Partial<Teameinteilung> = {}): Teameinteilung {
  return {
    erzeugtAm: '2099-01-13T17:45:00Z',
    erzeugtVon: 'Beispielspieler 01',
    veraltet: false,
    auswechselspieler: 'Beispielspieler 13',
    teamA: [
      { anzeigeName: 'Beispielspieler 11', gast: false, auswechselspieler: false },
      { anzeigeName: 'Beispielspieler 13', gast: false, auswechselspieler: true },
    ],
    teamB: [{ anzeigeName: 'Beispielspieler 12', gast: false, auswechselspieler: false }],
    ...teil,
  }
}

function rendern(teams: Teameinteilung, eigenerName: string | null = EIGENER_NAME, eigenerGast = false) {
  return render(<TeamsAnzeige teams={teams} eigenerName={eigenerName} eigenerGast={eigenerGast} />)
}

describe('TeamsAnzeige', () => {
  test('zeigt zwei Teams mit Zahl, die den Auswechselspieler mitzaehlt', () => {
    rendern(einteilung())
    expect(screen.getByRole('heading', { level: 3, name: 'Team A (2)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Team B (1)' })).toBeInTheDocument()
    expect(within(screen.getByTestId('teams-anzeige-a')).getAllByRole('listitem')).toHaveLength(2)
  })

  test('nennt Ersteller und Zeitpunkt in der Ueberschrift der Einteilung', () => {
    rendern(einteilung())
    const kopf = screen.getByRole('heading', { level: 2 })
    expect(kopf).toHaveTextContent('Einteilung von Beispielspieler 01,')
    expect(kopf).toHaveTextContent('Uhr')
    // Programmatisch fokussierbar, aber nicht per Tab erreichbar.
    expect(kopf).toHaveAttribute('tabindex', '-1')
  })

  test('kennzeichnet genau einen Auswechselspieler mit Text', () => {
    rendern(einteilung())
    expect(screen.getAllByTestId('teams-anzeige-auswechselspieler')).toHaveLength(1)
    expect(screen.getByTestId('teams-anzeige-auswechselspieler')).toHaveTextContent('Auswechselspieler')
  })

  test('zeigt bei gerader Zahl keinen Auswechselspieler', () => {
    rendern(
      einteilung({
        auswechselspieler: null,
        teamA: [{ anzeigeName: 'Beispielspieler 11', gast: false, auswechselspieler: false }],
        teamB: [{ anzeigeName: 'Beispielspieler 12', gast: false, auswechselspieler: false }],
      }),
    )
    expect(screen.queryByTestId('teams-anzeige-auswechselspieler')).not.toBeInTheDocument()
  })

  test('markiert Gaeste und den eigenen Eintrag', () => {
    rendern(
      einteilung({
        teamA: [
          { anzeigeName: EIGENER_NAME, gast: false, auswechselspieler: false },
          { anzeigeName: 'Beispielgast', gast: true, auswechselspieler: false },
        ],
        auswechselspieler: null,
      }),
    )
    const team = within(screen.getByTestId('teams-anzeige-a'))
    expect(team.getByText(`${EIGENER_NAME} (du)`)).toBeInTheDocument()
    expect(team.getByText('Beispielgast (Gast)')).toBeInTheDocument()
  })

  test('haelt einen Gast gleichen Namens nicht fuer den eigenen Eintrag', () => {
    rendern(
      einteilung({
        teamA: [{ anzeigeName: EIGENER_NAME, gast: true, auswechselspieler: false }],
        teamB: [],
        auswechselspieler: null,
      }),
    )
    expect(screen.queryByText(/\(du\)/)).not.toBeInTheDocument()
  })

  test('zeigt eine veraltete Einteilung weiter an und weist darauf hin', () => {
    // Verstecken waere falsch: Jemand hat die Aufstellung vielleicht schon vorgelesen.
    rendern(einteilung({ veraltet: true }))
    expect(screen.getByTestId('teams-anzeige-veraltet')).toHaveTextContent(
      'Seit dieser Einteilung hat sich die Teilnehmerliste geändert.',
    )
    expect(screen.getByTestId('teams-anzeige-a')).toBeInTheDocument()
    expect(screen.getByTestId('teams-anzeige-b')).toBeInTheDocument()
  })

  test('nennt den Weg zur Neugenerierung nur, wenn die Seite ihn anbietet', () => {
    const { rerender } = render(
      <TeamsAnzeige teams={einteilung({ veraltet: true })} eigenerName={null} eigenerGast={false} />,
    )
    expect(screen.getByTestId('teams-anzeige-veraltet')).not.toHaveTextContent('neu generieren')
    rerender(<TeamsAnzeige teams={einteilung({ veraltet: true })} eigenerName={null} eigenerGast={false} neuGenerierbar />)
    expect(screen.getByTestId('teams-anzeige-veraltet')).toHaveTextContent('Du kannst die Teams neu generieren.')
  })

  test('zeigt ohne Veraltung keinen Hinweis', () => {
    rendern(einteilung({ veraltet: false }))
    expect(screen.queryByTestId('teams-anzeige-veraltet')).not.toBeInTheDocument()
  })

  test('zeigt die Eintraege in der Reihenfolge der Lieferung', () => {
    // Keine Rangfolge, aber auch kein Umsortieren: Die Anzeige erfindet keine Ordnung.
    rendern(
      einteilung({
        teamA: [
          { anzeigeName: 'Z', gast: false, auswechselspieler: false },
          { anzeigeName: 'A', gast: false, auswechselspieler: false },
        ],
        teamB: [],
        auswechselspieler: null,
      }),
    )
    const namen = within(screen.getByTestId('teams-anzeige-a'))
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(namen).toEqual(['Z', 'A'])
  })
})
