import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import type { TerminUebersicht } from '@/api/termine/termine'
import AdminTerminZeile from './AdminTerminZeile'

function termin(teil: Partial<TerminUebersicht> = {}): TerminUebersicht {
  return {
    terminId: 41,
    serieId: null,
    datum: '2099-01-06',
    uhrzeit: '20:00:00',
    ort: 'Beispielhalle',
    status: 'GEPLANT',
    teilnehmerVersion: 1,
    zusagen: 8,
    ...teil,
  }
}

function rendern(teil: Partial<TerminUebersicht> = {}) {
  render(
    <MemoryRouter>
      <AdminTerminZeile termin={termin(teil)} />
    </MemoryRouter>,
  )
}

describe('AdminTerminZeile', () => {
  test('ist ein Link zur Verwaltung und zeigt Datum, Uhrzeit, Ort, Status und Zusagen', () => {
    rendern()

    const zeile = screen.getByTestId('admin-termin-zeile-41')
    expect(zeile).toHaveAttribute('href', '/admin/termine/41')
    expect(zeile).toHaveTextContent('Di., 06.01. · 20:00 Uhr')
    expect(zeile).toHaveTextContent('Beispielhalle')
    expect(screen.getByTestId('admin-termin-status-41')).toHaveTextContent('Geplant')
    expect(screen.getByTestId('admin-termin-zusagen-41')).toHaveTextContent('8 Zusagen')
  })

  test('liest dem Screenreader das ausgeschriebene Datum vor', () => {
    rendern()

    expect(screen.getByTestId('admin-termin-zeile-41')).toHaveAccessibleName(/Dienstag, 6\. Januar, 20:00 Uhr/)
  })

  test('benutzt die Einzahl bei einer Zusage', () => {
    rendern({ zusagen: 1 })

    expect(screen.getByTestId('admin-termin-zusagen-41')).toHaveTextContent('1 Zusage')
    expect(screen.getByTestId('admin-termin-zusagen-41')).not.toHaveTextContent('Zusagen')
  })

  test('ein abgesagter Termin bleibt ein Link (Entfernen), zeigt aber keine Zusagen', () => {
    rendern({ status: 'ABGESAGT', zusagen: 0 })

    expect(screen.getByTestId('admin-termin-zeile-41')).toHaveAttribute('href', '/admin/termine/41')
    expect(screen.getByTestId('admin-termin-status-41')).toHaveTextContent('Abgesagt')
    expect(screen.queryByTestId('admin-termin-zusagen-41')).not.toBeInTheDocument()
  })

  test('ein abgeschlossener Termin zeigt Status und Zusagen', () => {
    rendern({ status: 'ABGESCHLOSSEN', zusagen: 12 })

    expect(screen.getByTestId('admin-termin-status-41')).toHaveTextContent('Abgeschlossen')
    expect(screen.getByTestId('admin-termin-zusagen-41')).toHaveTextContent('12 Zusagen')
  })

  test('kennzeichnet einen Serientermin mit dem Wort „Serie“', () => {
    rendern({ serieId: 3 })

    expect(screen.getByTestId('admin-termin-serie-41')).toHaveTextContent('Serie')
  })

  test('ein Einzeltermin trägt keine Serienmarke, auch bei fehlendem serieId', () => {
    rendern({ serieId: undefined })

    expect(screen.queryByTestId('admin-termin-serie-41')).not.toBeInTheDocument()
  })

  test('lässt den Ort weg, wenn es keinen gibt', () => {
    rendern({ ort: null })

    expect(screen.getByTestId('admin-termin-zeile-41')).not.toHaveTextContent('Beispielhalle')
  })
})
