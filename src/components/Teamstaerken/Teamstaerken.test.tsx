import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { SkillKategorie } from '@/api/admin/skills'
import Teamstaerken from './Teamstaerken'

/** Erfundene Kategorien: Die Komponente darf keine Kategorie beim Namen kennen. */
const KATEGORIEN: SkillKategorie[] = [
  { schluessel: 'TEMPO', bezeichnung: 'Tempo', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 6 },
  { schluessel: 'TECHNIK', bezeichnung: 'Technik', gewicht: 1, reihenfolge: 2, minWert: 0, maxWert: 6 },
  { schluessel: 'HALTEN', bezeichnung: 'Halten', gewicht: 0.3, reihenfolge: 3, minWert: 0, maxWert: 3 },
]

describe('Teamstaerken', () => {
  function rendern(springer: string | null = null) {
    render(
      <Teamstaerken
        teamA={{ TEMPO: 9, TECHNIK: 7, HALTEN: 1 }}
        teamB={{ TEMPO: 8, TECHNIK: 6, HALTEN: 0 }}
        kategorien={KATEGORIEN}
        springer={springer}
      />,
    )
  }

  test('ist eingeklappt; die Schaltfläche blendet die Tabelle ein und aus und meldet den Zustand', () => {
    rendern()
    const schalter = screen.getByRole('button', { name: 'Teamstärken anzeigen' })
    const bereich = screen.getByTestId('teamstaerken-bereich')

    expect(schalter).toHaveAttribute('aria-expanded', 'false')
    expect(bereich).not.toBeVisible()
    // aria-controls zeigt auch eingeklappt auf ein vorhandenes Element.
    expect(schalter.getAttribute('aria-controls')).toBe(bereich.id)

    fireEvent.click(schalter)
    expect(schalter).toHaveAttribute('aria-expanded', 'true')
    expect(schalter).toHaveAccessibleName('Teamstärken ausblenden')
    expect(bereich).toBeVisible()

    fireEvent.click(schalter)
    expect(bereich).not.toBeVisible()
  })

  test('zeigt eine Tabelle „Kategorie, Team A, Team B“ mit einer Zeile je Kategorie', () => {
    rendern()
    fireEvent.click(screen.getByTestId('teamstaerken-umschalter'))

    const tabelle = screen.getByRole('table', { name: 'Gesamtpunkte je Team und Kategorie' })
    expect(within(tabelle).getAllByRole('columnheader').map((k) => k.textContent)).toEqual(['Kategorie', 'Team A', 'Team B'])
    const zeilen = within(tabelle).getAllByRole('row').slice(1)
    expect(zeilen.map((z) => [...z.querySelectorAll('th, td')].map((c) => c.textContent))).toEqual([
      ['Tempo', '9', '8'],
      ['Technik', '7', '6'],
      ['Halten', '1', '0'],
    ])
    expect(screen.getByTestId('teamstaerken-zeile-HALTEN')).toHaveTextContent('Halten10')
  })

  test('nennt den Springer, der nicht mitgezählt ist', () => {
    rendern('Beispielspieler 03')

    expect(screen.getByTestId('teamstaerken-springer')).toHaveTextContent(
      'Der Springer (Beispielspieler 03) ist in den Gesamtpunkten nicht berücksichtigt',
    )
  })

  test('ohne Springer sagt der Satz, dass alle berücksichtigt sind', () => {
    rendern(null)

    expect(screen.getByTestId('teamstaerken-springer')).toHaveTextContent('Es gibt keinen Springer; alle Eingeteilten sind berücksichtigt.')
  })
})
