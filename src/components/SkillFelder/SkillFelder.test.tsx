import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import type { SkillKategorie } from '@/api/admin/skills'
import SkillFelder from './SkillFelder'

/** Erfundene Kategorien: Nichts darf von den echten Schlüsseln abhängen. */
const kategorien: SkillKategorie[] = [
  { schluessel: 'ZEHN', bezeichnung: 'Zehnerwert', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 10 },
  { schluessel: 'KLEIN', bezeichnung: 'Kleinwert', gewicht: 0.3, reihenfolge: 2, minWert: 1, maxWert: 3 },
]

function rendern(teil: Partial<Parameters<typeof SkillFelder>[0]> = {}) {
  const beiAenderung = vi.fn()
  render(
    <SkillFelder kategorien={kategorien} werte={{ ZEHN: '5', KLEIN: '' }} beiAenderung={beiAenderung} {...teil} />,
  )
  return beiAenderung
}

describe('SkillFelder', () => {
  test('baut je Kategorie ein Zahlenfeld mit Bezeichnung, Grenzen und Bereichshinweis', () => {
    rendern()

    const zehn = screen.getByLabelText('Zehnerwert')
    expect(zehn).toHaveAttribute('type', 'number')
    expect(zehn).toHaveAttribute('inputmode', 'numeric')
    expect(zehn).toHaveAttribute('min', '0')
    expect(zehn).toHaveAttribute('max', '10')
    expect(zehn).toHaveAttribute('step', '1')
    expect(zehn).toHaveAccessibleDescription('0 bis 10')
    const klein = screen.getByLabelText('Kleinwert')
    expect(klein).toHaveAttribute('min', '1')
    expect(klein).toHaveAttribute('max', '3')
    expect(klein).toHaveAccessibleDescription('1 bis 3')
  })

  test('die Gruppe heisst „Skillwerte“ und folgt der Reihenfolge der Kategorien', () => {
    rendern()

    expect(screen.getByRole('group', { name: 'Skillwerte' })).toBeInTheDocument()
    const felder = screen.getAllByRole('spinbutton')
    expect(felder.map((f) => f.getAttribute('data-testid'))).toEqual(['skill-ZEHN', 'skill-KLEIN'])
  })

  test('zeigt die Werte als Text, leer bleibt leer (nicht 0)', () => {
    rendern({ werte: { ZEHN: '0', KLEIN: '' } })

    expect(screen.getByTestId('skill-ZEHN')).toHaveValue(0)
    expect(screen.getByTestId('skill-KLEIN')).toHaveValue(null)
  })

  test('meldet die Eingabe mit Schlüssel und Text', () => {
    const beiAenderung = rendern()

    fireEvent.change(screen.getByTestId('skill-KLEIN'), { target: { value: '2' } })

    expect(beiAenderung).toHaveBeenCalledWith('KLEIN', '2')
  })

  test('zeigt am Feld einen Text bei einem Wert ausserhalb des Bereichs, nicht bei leerem Feld', () => {
    rendern({ werte: { ZEHN: '11', KLEIN: '' } })

    expect(screen.getByLabelText('Zehnerwert')).toHaveAccessibleDescription(/Bitte eine ganze Zahl von 0 bis 10 eintragen/)
    expect(screen.getByLabelText('Kleinwert')).not.toHaveAttribute('aria-invalid')
  })

  test('der Fehlertext des Servers geht dem eigenen Hinweis vor', () => {
    rendern({ werte: { ZEHN: '11', KLEIN: '2' }, fehler: { ZEHN: 'Der Wert ist zu hoch.' } })

    expect(screen.getByLabelText('Zehnerwert')).toHaveAccessibleDescription(/Der Wert ist zu hoch\./)
  })

  test('kennzeichnet nicht bewertete Kategorien', () => {
    rendern({ werte: { ZEHN: '5', KLEIN: '' }, nichtBewertet: ['KLEIN'] })

    expect(screen.getByLabelText('Kleinwert')).toHaveAccessibleDescription('Noch nicht bewertet. 1 bis 3')
    expect(screen.getByLabelText('Zehnerwert')).toHaveAccessibleDescription('0 bis 10')
  })

  test('der Satz zur Vorbelegung steht nur auf Verlangen da', () => {
    rendern()
    expect(screen.queryByTestId('skill-vorbelegt-hinweis')).not.toBeInTheDocument()
  })

  test('mit Vorbelegung bittet der Satz, jeden Wert zu prüfen', () => {
    rendern({ vorbelegtHinweis: true })

    expect(screen.getByTestId('skill-vorbelegt-hinweis')).toHaveTextContent('Bitte prüfe jeden Wert.')
  })

  test('schreibgeschützt, solange gesendet wird', () => {
    rendern({ schreibgeschuetzt: true })

    expect(screen.getByTestId('skill-ZEHN')).toHaveAttribute('readonly')
  })
})
