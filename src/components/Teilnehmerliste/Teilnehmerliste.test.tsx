import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { Teilnehmerliste as Daten } from '@/api/termine/termine'
import { detailsVon, EIGENER_NAME, terminModell } from '@/test/mocks/termine'
import Teilnehmerliste from './Teilnehmerliste'

/** Liste mit `anzahl` Zusagen bei Hoechstzahl `max`; die letzten ueber `max` warten. */
function liste(anzahl: number, max = 22): Daten {
  const zusagen = Array.from({ length: anzahl }, (_, i) => ({ name: `Beispielspieler ${String(i + 11)}`, gast: false }))
  return detailsVon(terminModell({ terminId: 1, zusagen, max })).teilnehmerliste
}

function rendern(daten: Daten, teil: Partial<Parameters<typeof Teilnehmerliste>[0]> = {}) {
  return render(
    <Teilnehmerliste liste={daten} eigenerName={EIGENER_NAME} eigenerGast={false} eingeklappt={false} {...teil} />,
  )
}

describe('Teilnehmerliste', () => {
  test('zeigt die Eintraege in der Reihenfolge des Servers', () => {
    // Kein Umsortieren: Die Reihenfolge verbindet Zusagen und Warteschlange.
    const daten = liste(3)
    daten.teilnehmer = [daten.teilnehmer[2], daten.teilnehmer[0], daten.teilnehmer[1]].map((e, i) => ({
      ...e,
      position: i + 1,
    }))
    rendern(daten)
    const namen = within(screen.getByRole('list', { name: 'Teilnehmer' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent)
    expect(namen[0]).toContain('Beispielspieler 13')
    expect(namen[1]).toContain('Beispielspieler 11')
    expect(namen[2]).toContain('Beispielspieler 12')
  })

  test('markiert den eigenen Eintrag und Gaeste', () => {
    const daten = liste(2)
    daten.teilnehmer = [
      { position: 1, anzeigeName: EIGENER_NAME, gast: false, wartet: false },
      { position: 2, anzeigeName: 'Beispielgast', gast: true, wartet: false },
    ]
    rendern(daten)
    expect(screen.getByTestId('teilnehmerliste-eintrag-1')).toHaveTextContent(`${EIGENER_NAME} (du)`)
    expect(screen.getByTestId('teilnehmerliste-eintrag-2')).toHaveTextContent('Beispielgast (Gast)')
    expect(screen.getByTestId('teilnehmerliste-eintrag-2')).not.toHaveTextContent('(du)')
  })

  test('haelt einen Gast gleichen Namens nicht fuer den eigenen Eintrag', () => {
    const daten = liste(1)
    daten.teilnehmer = [{ position: 1, anzeigeName: EIGENER_NAME, gast: true, wartet: false }]
    rendern(daten)
    expect(screen.getByTestId('teilnehmerliste-eintrag-1')).not.toHaveTextContent('(du)')
  })

  test('nennt Wartende mit Platz und setzt den Satz nur einmal', () => {
    // 24 Zusagen bei Hoechstzahl 22: Position 23 und 24 warten, Platz 1 und 2.
    rendern(liste(24))
    expect(screen.getByTestId('teilnehmerliste-eintrag-22')).not.toHaveTextContent('wartet')
    expect(screen.getByTestId('teilnehmerliste-eintrag-23')).toHaveTextContent('wartet · Platz 1')
    expect(screen.getByTestId('teilnehmerliste-eintrag-24')).toHaveTextContent('wartet · Platz 2')
    expect(screen.getAllByTestId('teilnehmerliste-warteschlange')).toHaveLength(1)
    expect(screen.getByTestId('teilnehmerliste-eintrag-23')).toContainElement(
      screen.getByTestId('teilnehmerliste-warteschlange'),
    )
  })

  test('zeigt ohne Wartende keinen Warteschlangensatz', () => {
    rendern(liste(5))
    expect(screen.queryByTestId('teilnehmerliste-warteschlange')).not.toBeInTheDocument()
  })

  test('startet eingeklappt oder offen und zaehlt in der Zusammenfassung', () => {
    const { rerender } = rendern(liste(5), { eingeklappt: true })
    expect(screen.getByTestId('teilnehmerliste')).not.toHaveAttribute('open')
    expect(screen.getByTestId('teilnehmerliste-summary')).toHaveTextContent('Teilnehmer (5)')

    rerender(<Teilnehmerliste liste={liste(5)} eigenerName={EIGENER_NAME} eigenerGast={false} eingeklappt={false} />)
    expect(screen.getByTestId('teilnehmerliste')).toHaveAttribute('open')
  })

  test('nennt ohne Eintraege den Grund je nach Stand des Termins', () => {
    const { rerender } = rendern(liste(0))
    expect(screen.getByText('Noch keine Zusagen')).toBeInTheDocument()

    rerender(
      <Teilnehmerliste liste={liste(0)} eigenerName={EIGENER_NAME} eigenerGast={false} eingeklappt={false} beendet />,
    )
    expect(screen.getByText('Keine Zusagen')).toBeInTheDocument()
  })
})
