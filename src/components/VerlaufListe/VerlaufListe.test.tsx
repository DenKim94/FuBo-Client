import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import { datumKurz } from '@/api/termine/terminZeit'
import { terminModell, uebersichtVon } from '@/test/mocks/termine'
import VerlaufListe from './VerlaufListe'

const abgeschlossen = uebersichtVon(
  terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: '2026-09-29', ort: 'Beispielhalle' }),
)
const abgesagt = uebersichtVon(terminModell({ terminId: 2, status: 'ABGESAGT', datum: '2026-09-22', zusagen: [] }))

function rendern(...termine: Parameters<typeof VerlaufListe>[0]['termine']) {
  render(
    <MemoryRouter>
      <VerlaufListe termine={termine} />
    </MemoryRouter>,
  )
}

describe('VerlaufListe', () => {
  test('zeigt Datum, Uhrzeit, Ort, Status mit Text und die Zahl der Zusagen', () => {
    rendern(abgeschlossen)
    const zeile = screen.getByTestId('verlauf-link-1')

    expect(zeile).toHaveTextContent(datumKurz('2026-09-29'))
    expect(zeile).toHaveTextContent('19:00 Uhr')
    expect(zeile).toHaveTextContent('Beispielhalle')
    expect(zeile).toHaveTextContent('Abgeschlossen')
    expect(zeile).toHaveTextContent('8 Zusagen')
  })

  test('verlinkt einen abgeschlossenen Termin auf sein Ergebnis', () => {
    rendern(abgeschlossen)
    expect(screen.getByTestId('verlauf-link-1')).toHaveAttribute('href', '/ergebnisse/1')
  })

  test('zeigt einen abgesagten Termin ohne Link und ohne Zusagen', () => {
    rendern(abgesagt)
    const zeile = screen.getByTestId('verlauf-zeile-2')

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('verlauf-link-2')).not.toBeInTheDocument()
    expect(zeile).toHaveTextContent('Abgesagt')
    expect(zeile).not.toHaveTextContent('Zusagen')
  })

  test('laesst den Ort weg, wenn es keinen gibt, ohne leeren Platzhalter', () => {
    rendern({ ...abgeschlossen, ort: null })
    const zeile = screen.getByTestId('verlauf-link-1')
    expect(zeile).not.toHaveTextContent('Beispielhalle')
    // Zeit und Status bleiben; kein Gedankenstrich, kein „Kein Ort“.
    expect(zeile).not.toHaveTextContent('–')
  })

  test('behaelt die gelieferte Reihenfolge', () => {
    rendern(abgeschlossen, abgesagt)
    const zeilen = within(screen.getByTestId('verlauf-liste')).getAllByRole('listitem')
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toHaveTextContent('Abgeschlossen')
    expect(zeilen[1]).toHaveTextContent('Abgesagt')
  })
})
