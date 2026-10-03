import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Leerzustand from './Leerzustand'

describe('Leerzustand', () => {
  test('nennt Grund und naechsten Schritt', () => {
    render(<Leerzustand titel="Noch keine Zusagen" text="Sei der Erste." />)

    expect(screen.getByRole('heading', { level: 2, name: 'Noch keine Zusagen' })).toBeInTheDocument()
    expect(screen.getByText('Sei der Erste.')).toBeInTheDocument()
    // Ein Ergebnis, kein Ereignis: wird nicht als Alarm vorgelesen.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('zeigt eine uebergebene Aktion und waehlt die Ueberschriftenebene', () => {
    render(
      <Leerzustand
        titel="Seite nicht gefunden"
        text="Diese Adresse gibt es nicht."
        titelEbene={1}
        aktion={<button type="button">Zur Startseite</button>}
      />,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seite nicht gefunden')
    expect(screen.getByTestId('leerzustand')).toContainElement(screen.getByRole('button', { name: 'Zur Startseite' }))
  })
})
