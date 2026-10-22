import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, test } from 'vitest'
import Textbereich from './Textbereich'

describe('Textbereich', () => {
  test('verknuepft Beschriftung und Hinweis mit dem Feld', () => {
    render(<Textbereich beschriftung="Vorlage" hinweis="Leer lassen für den Standardtext." />)
    const feld = screen.getByLabelText('Vorlage')
    expect(feld.tagName).toBe('TEXTAREA')
    expect(feld).toHaveAccessibleDescription('Leer lassen für den Standardtext.')
    expect(feld).not.toHaveAttribute('aria-invalid')
  })

  test('meldet einen Fehler auch ohne Farbe', () => {
    render(<Textbereich beschriftung="Vorlage" hinweis="Hinweis." fehler="Zu lang." data-testid="vorlage" />)
    const feld = screen.getByLabelText('Vorlage')
    expect(feld).toHaveAttribute('aria-invalid', 'true')
    expect(feld).toHaveAccessibleDescription('Hinweis. Zu lang.')
    expect(screen.getByTestId('vorlage-fehler')).toHaveTextContent('Zu lang.')
  })

  test('verknuepft ein beschreibendes Element ausserhalb nach Hinweis und Fehler', () => {
    render(
      <>
        <p id="effektiv">So lautet der Text.</p>
        <Textbereich beschriftung="Vorlage" hinweis="Hinweis." beschriebenDurch="effektiv" />
      </>,
    )
    expect(screen.getByLabelText('Vorlage')).toHaveAccessibleDescription('Hinweis. So lautet der Text.')
  })

  test('uebernimmt Attribute und reicht ref an das Eingabeelement durch', () => {
    const ref = createRef<HTMLTextAreaElement>()
    render(<Textbereich ref={ref} beschriftung="Vorlage" rows={3} maxLength={500} data-testid="vorlage" />)
    expect(ref.current).toBe(screen.getByTestId('vorlage'))
    expect(screen.getByTestId('vorlage')).toHaveAttribute('rows', '3')
    expect(screen.getByTestId('vorlage')).toHaveAttribute('maxlength', '500')
  })
})
