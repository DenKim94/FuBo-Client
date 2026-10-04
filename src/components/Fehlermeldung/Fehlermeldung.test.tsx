import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ApiFehler, TEXT_NICHT_ERREICHBAR } from '@/api/common/fehler'
import Fehlermeldung from './Fehlermeldung'

/**
 * Erwarteter Textinhalt der Meldung. `toHaveTextContent` normalisiert nur den
 * Text des Elements (der Umbruch `\n` wird dort zum Leerzeichen), nicht den
 * Vergleichswert – deshalb hier dieselbe Normalisierung.
 */
const ALS_TEXTINHALT = TEXT_NICHT_ERREICHBAR.replace(/\s+/g, ' ')

describe('Fehlermeldung', () => {
  test('meldet einen eigenen Text als Alarm und verweist mit der id darauf', () => {
    render(
      <Fehlermeldung id="pin-fehler" data-testid="pin-fehler">
        Die PIN ist falsch.
      </Fehlermeldung>,
    )
    const meldung = screen.getByRole('alert')
    expect(meldung).toHaveTextContent('Die PIN ist falsch.')
    expect(meldung).toHaveAttribute('id', 'pin-fehler')
    // Das Symbol ist schmueckend: Die Aussage steht im Text.
    expect(screen.getByTestId('icon-error_circle_icon')).toHaveAttribute('aria-hidden', 'true')
  })

  test('zeigt bei einer Serverantwort deren Text', () => {
    render(<Fehlermeldung fehler={new ApiFehler(409, 'NAME_BELEGT', 'Der Name ist belegt.')} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Der Name ist belegt.')
  })

  test('zeigt bei einem Netzfehler denselben Text und dasselbe Symbol wie bei einer Proxy-Fehlerseite', () => {
    // Fehlerbild 04.10.2026: Fiel der Server der Anwendung aus, fehlte das
    // Symbol, und der Text wich von dem bei ausgefallenem Backend ab.
    const { unmount } = render(<Fehlermeldung fehler={new TypeError('Failed to fetch')} />)
    expect(screen.getByRole('alert')).toHaveTextContent(ALS_TEXTINHALT)
    // Der feste Umbruch kommt unverändert im DOM an; sichtbar macht ihn
    // `white-space: pre-line` (im Browser geprüft, jsdom rendert kein CSS).
    expect(screen.getByRole('alert').textContent).toContain('erreichbar.\nBitte')
    expect(screen.getByTestId('icon-error_circle_icon')).toBeInTheDocument()
    unmount()

    render(<Fehlermeldung fehler={new ApiFehler(502, 'UNBEKANNT', TEXT_NICHT_ERREICHBAR)} />)
    expect(screen.getByRole('alert')).toHaveTextContent(ALS_TEXTINHALT)
    expect(screen.getByTestId('icon-error_circle_icon')).toBeInTheDocument()
  })
})
