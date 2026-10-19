import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import type { SkillKategorie } from '@/api/admin/skills'
import Netzdiagramm from './Netzdiagramm'

function kategorie(schluessel: string, bezeichnung: string, maxWert = 6): SkillKategorie {
  return { schluessel, bezeichnung, gewicht: 1, reihenfolge: 1, minWert: 0, maxWert }
}

const fuenf: SkillKategorie[] = [
  kategorie('A', 'Angriff'),
  kategorie('V', 'Verteidigung'),
  kategorie('S', 'Spielstärke'),
  kategorie('L', 'Laufstärke'),
  kategorie('T', 'Torwart', 3),
]

describe('Netzdiagramm', () => {
  test('ist ein Bild mit einer Beschreibung aller Werte', () => {
    render(<Netzdiagramm kategorien={fuenf} skills={{ A: 4, V: 2, S: 3, L: 5, T: 1 }} />)

    expect(screen.getByRole('img', { name: 'Netzdiagramm: Angriff 4, Verteidigung 2, Spielstärke 3, Laufstärke 5, Torwart 1' })).toBe(
      screen.getByTestId('netzdiagramm'),
    )
  })

  test('eine Lücke in der Karte heisst „nicht bewertet“ und steht als Strich an der Ecke', () => {
    const { container } = render(<Netzdiagramm kategorien={fuenf} skills={{ A: 4, V: 2, S: 3 }} />)

    expect(screen.getByRole('img')).toHaveAccessibleName(/Laufstärke nicht bewertet, Torwart nicht bewertet/)
    expect(container.querySelectorAll('text')[3]).toHaveTextContent('Laufstärke–')
  })

  test('jede Ecke trägt Name und Wert als Text', () => {
    const { container } = render(<Netzdiagramm kategorien={fuenf} skills={{ A: 4, V: 2, S: 3, L: 5, T: 1 }} />)

    const texte = Array.from(container.querySelectorAll('text')).map((t) => t.textContent)
    expect(texte).toEqual(['Angriff4', 'Verteidigung2', 'Spielstärke3', 'Laufstärke5', 'Torwart1'])
  })

  test('zeichnet Ringe, eine Fläche, je Kategorie eine Achse und eine Ecke', () => {
    const { container } = render(<Netzdiagramm kategorien={fuenf} skills={{ A: 4, V: 2, S: 3, L: 5, T: 1 }} />)

    // Sechs Ringe für die Spanne 6 plus die Fläche der Werte.
    expect(container.querySelectorAll('polygon')).toHaveLength(7)
    expect(container.querySelectorAll('line')).toHaveLength(5)
    expect(container.querySelectorAll('circle')).toHaveLength(5)
  })

  test('die Achsen entstehen aus den Kategorien: mit sechs Kategorien sechs Achsen', () => {
    const sechs = [...fuenf, kategorie('X', 'Extra')]
    const { container } = render(<Netzdiagramm kategorien={sechs} skills={{}} />)

    expect(container.querySelectorAll('line')).toHaveLength(6)
  })

  test('mit weniger als drei Kategorien entfällt die Zeichnung', () => {
    const { container } = render(<Netzdiagramm kategorien={fuenf.slice(0, 2)} skills={{ A: 1, V: 1 }} />)

    expect(container).toBeEmptyDOMElement()
  })

  test('verwendet die übergebene Test-ID', () => {
    render(<Netzdiagramm kategorien={fuenf} skills={{}} data-testid="mein-netz" />)

    expect(screen.getByTestId('mein-netz')).toBeInTheDocument()
  })

  test('nutzt keine festen Farben: Füllung und Linien kommen aus dem Stylesheet', () => {
    const { container } = render(<Netzdiagramm kategorien={fuenf} skills={{ A: 4 }} />)

    expect(container.querySelector('[fill], [stroke]')).toBeNull()
  })
})
