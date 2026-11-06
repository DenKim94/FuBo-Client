import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { AbsageEintrag } from '@/api/termine/termine'
import Absagenliste from './Absagenliste'

const ABSAGEN: AbsageEintrag[] = [
  { anzeigeName: 'Anton', gast: false },
  { anzeigeName: 'Beispielgast', gast: true },
  { anzeigeName: 'Zora', gast: false },
]

function rendern(teil: Partial<Parameters<typeof Absagenliste>[0]> = {}) {
  render(<Absagenliste absagen={ABSAGEN} eigenerName={null} eigenerGast={false} eingeklappt={false} {...teil} />)
}

describe('Absagenliste', () => {
  test('nennt die Zahl in der Kopfzeile und zeigt die Namen in der gelieferten Reihenfolge, ohne Positionen', () => {
    rendern()
    expect(screen.getByTestId('absagenliste-summary')).toHaveTextContent('Absagen (3)')
    const liste = screen.getByRole('list', { name: 'Absagen' })
    // Ungeordnete Liste: Es gibt keine Rangfolge (der Server sortiert alphabetisch).
    expect(liste.tagName).toBe('UL')
    expect(within(liste).getAllByRole('listitem').map((e) => e.textContent)).toEqual(['Anton', 'Beispielgast (Gast)', 'Zora'])
  })

  test('kennzeichnet den eigenen Eintrag mit „(du)“ – Name und Gast-Kennzeichen müssen passen', () => {
    rendern({ eigenerName: 'Zora', eigenerGast: false })
    expect(screen.getByText('Zora (du)')).toBeInTheDocument()

    rendern({ eigenerName: 'Beispielgast', eigenerGast: false, 'data-testid': 'zweite' })
    // Ein Profil, das so heißt wie der Gast, ist nicht der Gast.
    expect(within(screen.getByTestId('zweite')).getByText('Beispielgast (Gast)')).toBeInTheDocument()
  })

  test('klappt auf und zu wie die Teilnehmerliste; der Pfeil erscheint nur mit Absagen', async () => {
    rendern({ eingeklappt: true })
    const liste = screen.getByTestId('absagenliste')
    expect(liste).not.toHaveAttribute('open')
    expect(screen.getByTestId('absagenliste-pfeil')).toHaveAttribute('aria-hidden', 'true')

    await userEvent.click(screen.getByTestId('absagenliste-summary'))
    expect(liste).toHaveAttribute('open')
  })

  test('ohne Absagen: Kopfzeile mit 0, kein Pfeil, ein kurzer Satz statt einer Liste', () => {
    rendern({ absagen: [] })
    expect(screen.getByTestId('absagenliste-summary')).toHaveTextContent('Absagen (0)')
    expect(screen.queryByTestId('absagenliste-pfeil')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByTestId('absagenliste-leer')).toHaveTextContent('Bisher hat niemand abgesagt.')
  })

  test('nach dem Termin steht der Satz in der Vergangenheit', () => {
    rendern({ absagen: [], beendet: true })
    expect(screen.getByTestId('absagenliste-leer')).toHaveTextContent('Für diesen Termin gab es keine Absagen.')
  })
})
