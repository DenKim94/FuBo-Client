import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import type { TerminUebersicht } from '@/api/termine/termine'
import { terminModell, uebersichtVon } from '@/test/mocks/termine'
import WeitereTermine from './WeitereTermine'

function termine(anzahl: number): TerminUebersicht[] {
  return Array.from({ length: anzahl }, (_, i) =>
    uebersichtVon(terminModell({ terminId: 200 + i, datum: `2099-02-${String(i + 1).padStart(2, '0')}` })),
  )
}

function rendern(liste: TerminUebersicht[], max?: number) {
  return render(
    <MemoryRouter>
      <WeitereTermine termine={liste} max={max} />
    </MemoryRouter>,
  )
}

describe('WeitereTermine', () => {
  test('rendert ohne Termine nichts', () => {
    rendern([])
    expect(screen.queryByTestId('weitere-termine')).not.toBeInTheDocument()
  })

  test('zeigt hoechstens fuenf Zeilen als Links auf den Termin', () => {
    rendern(termine(8))
    expect(screen.getAllByRole('link')).toHaveLength(5)
    expect(screen.getByTestId('termin-link-200')).toHaveAttribute('href', '/termine/200')
    expect(screen.queryByTestId('termin-link-205')).not.toBeInTheDocument()
  })

  test('zeigt Zusagen und eigene Rueckmeldung je Zeile', () => {
    const liste = [
      uebersichtVon(terminModell({ terminId: 1, eigene: true })),
      uebersichtVon(terminModell({ terminId: 2, eigene: false })),
      uebersichtVon(terminModell({ terminId: 3, eigene: null })),
    ]
    rendern(liste)
    expect(screen.getByTestId('termin-link-1')).toHaveTextContent('Du hast zugesagt.')
    expect(screen.getByTestId('termin-link-2')).toHaveTextContent('Du hast abgesagt.')
    expect(screen.getByTestId('termin-link-3')).toHaveTextContent('Anmeldung ausstehend.')
  })

  test('zeigt bei einem abgesagten Termin „Abgesagt“ statt der Rueckmeldung', () => {
    rendern([uebersichtVon(terminModell({ terminId: 9, status: 'ABGESAGT', zusagen: [] }))])
    const zeile = screen.getByTestId('termin-link-9')
    expect(zeile).toHaveTextContent('Abgesagt')
    expect(zeile).not.toHaveTextContent('Zusagen')
    expect(zeile).not.toHaveTextContent('Anmeldung ausstehend')
  })

  test('zeigt den Ort nur, wenn es einen gibt', () => {
    rendern([
      uebersichtVon(terminModell({ terminId: 1, ort: 'Beispielhalle' })),
      uebersichtVon(terminModell({ terminId: 2, ort: null })),
    ])
    expect(screen.getByTestId('termin-link-1')).toHaveTextContent('Beispielhalle')
    expect(screen.getByTestId('termin-link-2')).not.toHaveTextContent('Beispielhalle')
  })
})
