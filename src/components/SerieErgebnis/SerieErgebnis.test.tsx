import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import type { SerieAngelegt } from '@/api/admin/adminTermine'
import SerieErgebnis from './SerieErgebnis'

const ergebnis: SerieAngelegt = {
  serieId: 3,
  titel: 'Beispielserie',
  angelegteTermine: [
    { terminId: 201, datum: '2099-01-06', uhrzeit: '20:00:00' },
    { terminId: 202, datum: '2099-01-20', uhrzeit: '20:00:00' },
  ],
  uebersprungeneTermine: ['2099-01-13'],
}

function rendern(eigenschaften: Partial<Parameters<typeof SerieErgebnis>[0]> = {}) {
  render(
    <MemoryRouter>
      <SerieErgebnis ergebnis={ergebnis} {...eigenschaften} />
    </MemoryRouter>,
  )
}

describe('SerieErgebnis', () => {
  test('nennt die Zahl der angelegten Termine und verlinkt jeden zur Verwaltung', () => {
    rendern()

    expect(screen.getByRole('heading', { level: 2, name: 'Serie angelegt' })).toBeInTheDocument()
    expect(screen.getByTestId('serie-angelegt-anzahl')).toHaveTextContent('2 Termine angelegt.')
    expect(screen.getByTestId('serie-termin-201')).toHaveAttribute('href', '/admin/termine/201')
    expect(screen.getByTestId('serie-termin-202')).toHaveTextContent('20:00 Uhr')
  })

  test('benutzt die Einzahl bei genau einem Termin', () => {
    rendern({ ergebnis: { ...ergebnis, angelegteTermine: [ergebnis.angelegteTermine[0]] } })

    expect(screen.getByTestId('serie-angelegt-anzahl')).toHaveTextContent('1 Termin angelegt.')
  })

  test('nennt übersprungene Zeitpunkte mit Datum und Begründung', () => {
    rendern()

    expect(screen.getByTestId('serie-uebersprungen')).toHaveTextContent(
      'Übersprungen, weil zu diesem Zeitpunkt bereits ein Termin liegt:',
    )
    expect(screen.getByTestId('serie-uebersprungen-2099-01-13')).toHaveTextContent('Dienstag, 13. Januar')
    expect(screen.queryByTestId('serie-uebersprungen-leer')).not.toBeInTheDocument()
  })

  test('der Absatz zu den übersprungenen Zeitpunkten ist auch ohne solche da', () => {
    rendern({ ergebnis: { ...ergebnis, uebersprungeneTermine: [] } })

    expect(screen.getByTestId('serie-uebersprungen-leer')).toHaveTextContent('Es wurde kein Zeitpunkt übersprungen.')
    expect(screen.queryByTestId('serie-uebersprungen')).not.toBeInTheDocument()
  })

  test('die Überschrift ist ein Fokusziel', () => {
    const ref = createRef<HTMLHeadingElement>()
    rendern({ ueberschriftRef: ref })

    ref.current?.focus()
    expect(screen.getByTestId('serie-ergebnis-titel')).toHaveFocus()
  })

  test('führt mit „Zu den Terminen“ zur Liste', () => {
    rendern()

    expect(screen.getByTestId('serie-zu-den-terminen')).toHaveAttribute('href', '/admin/termine')
  })
})
