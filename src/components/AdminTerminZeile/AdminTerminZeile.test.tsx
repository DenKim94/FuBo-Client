import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test, vi } from 'vitest'
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

function rendern(teil: Partial<TerminUebersicht> = {}, beiEntfernen = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/admin/termine']}>
      <Routes>
        <Route path="/admin/termine" element={<AdminTerminZeile termin={termin(teil)} beiEntfernen={beiEntfernen} />} />
        <Route path="/admin/termine/:terminId" element={<p data-testid="verwaltung">Verwaltung</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return beiEntfernen
}

describe('AdminTerminZeile', () => {
  test('ist eine Karte mit Datum, Uhrzeit, Ort, Status und Zusagen', () => {
    rendern()

    const karte = screen.getByTestId('admin-termin-zeile-41')
    expect(karte).toHaveTextContent('Di., 06.01. · 20:00 Uhr')
    expect(karte).toHaveTextContent('Beispielhalle')
    expect(screen.getByTestId('admin-termin-status-41')).toHaveTextContent('Geplant')
    expect(screen.getByTestId('admin-termin-zusagen-41')).toHaveTextContent('8 Zusagen')
  })

  test('„Bearbeiten“ öffnet die Verwaltung des Termins', async () => {
    rendern()

    await userEvent.click(screen.getByTestId('admin-termin-bearbeiten-41'))

    expect(screen.getByTestId('verwaltung')).toBeInTheDocument()
  })

  test('„Entfernen“ meldet den Termin an die Liste und navigiert nicht', async () => {
    const beiEntfernen = rendern()

    await userEvent.click(screen.getByTestId('admin-termin-entfernen-41'))

    expect(beiEntfernen).toHaveBeenCalledTimes(1)
    expect(beiEntfernen).toHaveBeenCalledWith(expect.objectContaining({ terminId: 41 }))
    expect(screen.queryByTestId('verwaltung')).not.toBeInTheDocument()
  })

  test('die Schaltflächen nennen den Termin für Screenreader', () => {
    rendern()

    expect(screen.getByTestId('admin-termin-bearbeiten-41')).toHaveAccessibleName(
      'Bearbeiten: Dienstag, 6. Januar, 20:00 Uhr',
    )
    expect(screen.getByTestId('admin-termin-entfernen-41')).toHaveAccessibleName(
      'Entfernen: Dienstag, 6. Januar, 20:00 Uhr',
    )
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

  test('ein abgesagter Termin zeigt keine Zusagen, lässt sich öffnen und entfernen', () => {
    rendern({ status: 'ABGESAGT', zusagen: 0 })

    expect(screen.getByTestId('admin-termin-status-41')).toHaveTextContent('Abgesagt')
    expect(screen.queryByTestId('admin-termin-zusagen-41')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-termin-bearbeiten-41')).toHaveTextContent('Öffnen')
    expect(screen.getByTestId('admin-termin-entfernen-41')).toBeInTheDocument()
  })

  test('ein abgeschlossener Termin zeigt Status und Zusagen', () => {
    rendern({ status: 'ABGESCHLOSSEN', zusagen: 12 })

    expect(screen.getByTestId('admin-termin-status-41')).toHaveTextContent('Abgeschlossen')
    expect(screen.getByTestId('admin-termin-zusagen-41')).toHaveTextContent('12 Zusagen')
  })

  test('ein abgeschlossener Termin ist nicht entfernbar und heisst „Öffnen“', () => {
    rendern({ status: 'ABGESCHLOSSEN' })

    expect(screen.getByTestId('admin-termin-bearbeiten-41')).toHaveTextContent('Öffnen')
    expect(screen.queryByTestId('admin-termin-entfernen-41')).not.toBeInTheDocument()
  })

  test('kennzeichnet einen Serientermin mit dem Wort „Serie“', () => {
    rendern({ serieId: 3 })

    expect(screen.getByTestId('admin-termin-serie-41')).toHaveTextContent('Serie')
    expect(screen.queryByTestId('admin-termin-einzel-41')).not.toBeInTheDocument()
  })

  test('kennzeichnet einen Einzeltermin mit dem Wort „Einzeltermin“', () => {
    rendern()

    expect(screen.getByTestId('admin-termin-einzel-41')).toHaveTextContent('Einzeltermin')
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
