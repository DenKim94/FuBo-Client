import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, test } from 'vitest'
import TerminKarte from './TerminKarte'

const geplant = { datum: '2099-01-13', uhrzeit: '19:00:00', ort: 'Beispielhalle', status: 'GEPLANT' } as const

describe('TerminKarte', () => {
  test('zeigt Datum und Uhrzeit als Ueberschrift der gewaehlten Ebene', () => {
    render(<TerminKarte termin={geplant} ebene={1} />)
    const titel = screen.getByRole('heading', { level: 1 })
    expect(titel).toHaveTextContent('19:00 Uhr')
    expect(titel.querySelector('time')).toHaveAttribute('datetime', '2099-01-13T19:00')
  })

  test('nutzt in Listen eine Ueberschrift der Ebene 2', () => {
    render(<TerminKarte termin={geplant} ebene={2} />)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  test('nutzt unter einer Abschnittsueberschrift (Admin-Dashboard) die Ebene 3', () => {
    render(<TerminKarte termin={geplant} ebene={3} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('19:00 Uhr')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  test('gibt Screenreadern die ausgeschriebene Form', () => {
    // Die Abkuerzung „Di“ liefe als Buchstaben; die Langform steht daneben.
    render(<TerminKarte termin={geplant} />)
    const lang = screen.getByText(/Uhr$/, { selector: '.nurFuerScreenreader' })
    expect(lang).toHaveTextContent('Dienstag, 13. Januar, 19:00 Uhr')
  })

  test('zeigt den Ort nur, wenn es einen gibt', () => {
    const { rerender } = render(<TerminKarte termin={geplant} />)
    expect(screen.getByTestId('termin-karte-ort')).toHaveTextContent('Beispielhalle')

    rerender(<TerminKarte termin={{ ...geplant, ort: null }} />)
    expect(screen.queryByTestId('termin-karte-ort')).not.toBeInTheDocument()

    rerender(<TerminKarte termin={{ ...geplant, ort: '   ' }} />)
    expect(screen.queryByTestId('termin-karte-ort')).not.toBeInTheDocument()
  })

  test('kennzeichnet „Abgesagt“ und „Abgeschlossen“ mit Text', () => {
    const { rerender } = render(<TerminKarte termin={{ ...geplant, status: 'ABGESAGT' }} />)
    expect(screen.getByTestId('termin-karte-status')).toHaveTextContent('Abgesagt')

    rerender(<TerminKarte termin={{ ...geplant, status: 'ABGESCHLOSSEN' }} />)
    expect(screen.getByTestId('termin-karte-status')).toHaveTextContent('Abgeschlossen')

    rerender(<TerminKarte termin={geplant} />)
    expect(screen.queryByTestId('termin-karte-status')).not.toBeInTheDocument()
  })

  test('macht die Ueberschrift mit ueberschriftRef zum Fokusziel', () => {
    const ref = createRef<HTMLHeadingElement>()
    render(<TerminKarte termin={geplant} ueberschriftRef={ref} />)

    const titel = screen.getByRole('heading', { level: 1 })
    expect(ref.current).toBe(titel)
    expect(titel).toHaveAttribute('tabindex', '-1')
    ref.current?.focus()
    expect(titel).toHaveFocus()
  })

  test('ohne ueberschriftRef ist die Ueberschrift kein Tabstopp und kein Fokusziel', () => {
    render(<TerminKarte termin={geplant} />)

    expect(screen.getByRole('heading', { level: 1 })).not.toHaveAttribute('tabindex')
  })
})
