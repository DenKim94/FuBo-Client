import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ApiFehler, TEXT_NICHT_ERREICHBAR } from '@/api/common/fehler'
import Fehlerzustand from './Fehlerzustand'

/**
 * Erwarteter Textinhalt der Meldung. `toHaveTextContent` normalisiert nur den
 * Text des Elements (der Umbruch `\n` wird dort zum Leerzeichen), nicht den
 * Vergleichswert – deshalb hier dieselbe Normalisierung.
 */
const ALS_TEXTINHALT = TEXT_NICHT_ERREICHBAR.replace(/\s+/g, ' ')

describe('Fehlerzustand', () => {
  test('zeigt den Text des Servers unveraendert', () => {
    render(<Fehlerzustand fehler={new ApiFehler(403, 'KEINE_BERECHTIGUNG', 'Dafür fehlt dir die Berechtigung.')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Dafür fehlt dir die Berechtigung.')
  })

  test('bietet bei 500 einen neuen Versuch an', () => {
    const erneut = vi.fn()
    render(<Fehlerzustand fehler={new ApiFehler(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.')} erneut={erneut} />)

    fireEvent.click(screen.getByTestId('fehlerzustand-erneut'))
    expect(erneut).toHaveBeenCalledTimes(1)
  })

  test('bietet bei einem Netzfehler einen neuen Versuch an und nennt eigene Worte', () => {
    render(<Fehlerzustand fehler={new TypeError('Failed to fetch')} erneut={() => {}} />)

    expect(screen.getByRole('alert')).toHaveTextContent(ALS_TEXTINHALT)
    expect(screen.getByTestId('fehlerzustand-erneut')).toBeInTheDocument()
  })

  test('bietet bei 409 keinen neuen Versuch an', () => {
    // Fachliche Ablehnung: Der Server antwortete beim zweiten Mal genauso.
    render(
      <Fehlerzustand fehler={new ApiFehler(409, 'NAME_BELEGT', 'Der Name ist belegt.')} erneut={() => {}} />,
    )
    expect(screen.queryByTestId('fehlerzustand-erneut')).not.toBeInTheDocument()
  })

  test('nutzt den Ersatztext fuer Fehler ohne Serverantwort und ohne Netzfehler', () => {
    render(<Fehlerzustand fehler={new Error('kaputt')} ersatz="Die Liste konnte nicht geladen werden." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Die Liste konnte nicht geladen werden.')
  })
})
