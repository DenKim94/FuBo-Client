import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  test('baut je Kategorie eine Gruppe mit einem Segment je Stufe von der unteren bis zur oberen Grenze', () => {
    rendern()

    const zehn = screen.getByRole('group', { name: /Zehnerwert/ })
    expect(within(zehn).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(
      Array.from({ length: 11 }, (_, i) => String(i)),
    )
    const klein = screen.getByRole('group', { name: /Kleinwert/ })
    expect(within(klein).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['1', '2', '3'])
  })

  test('die Überschrift heisst „Skills“, die Gruppen folgen der Reihenfolge der Kategorien', () => {
    rendern()

    expect(screen.getByRole('heading', { level: 2, name: 'Skills' })).toBeInTheDocument()
    const gruppen = screen.getAllByRole('group').map((g) => g.getAttribute('data-testid'))
    expect(gruppen).toEqual(['skill-ZEHN', 'skill-KLEIN'])
  })

  test('der gewählte Wert ist angehakt; die Legende nennt nur den Namen der Kategorie, ohne Zahl', () => {
    rendern({ werte: { ZEHN: '0', KLEIN: '' } })

    expect(screen.getByTestId('skill-ZEHN-0')).toBeChecked()
    expect(screen.getByRole('group', { name: 'Zehnerwert' })).toBeInTheDocument()
    const klein = screen.getByTestId('skill-KLEIN')
    expect(within(klein).queryAllByRole('radio', { checked: true })).toHaveLength(0)
    expect(screen.getByRole('group', { name: 'Kleinwert' })).toBeInTheDocument()
  })

  test('meldet die Wahl mit Schlüssel und Text', async () => {
    const beiAenderung = rendern()

    await userEvent.click(screen.getByTestId('skill-KLEIN-2'))

    expect(beiAenderung).toHaveBeenCalledWith('KLEIN', '2')
  })

  test('der Kopf nennt nur „Skills“, keinen Durchschnitt', () => {
    rendern({ werte: { ZEHN: '5', KLEIN: '2' } })
    expect(screen.getByRole('heading', { level: 2, name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByTestId('skill-felder')).not.toHaveTextContent('Ø')
  })

  test('ein Wert ausserhalb des Bereichs wählt kein Segment an', () => {
    rendern({ werte: { ZEHN: '11', KLEIN: '' } })

    expect(within(screen.getByTestId('skill-ZEHN')).queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  test('der Fehlertext des Servers steht an der Gruppe', () => {
    rendern({ werte: { ZEHN: '5', KLEIN: '2' }, fehler: { ZEHN: 'Der Wert ist zu hoch.' } })

    expect(screen.getByTestId('skill-ZEHN')).toHaveAccessibleDescription(/Der Wert ist zu hoch\./)
    expect(screen.getByTestId('skill-ZEHN-fehler')).toHaveTextContent('Der Wert ist zu hoch.')
    expect(screen.queryByTestId('skill-KLEIN-fehler')).not.toBeInTheDocument()
  })

  test('kennzeichnet nicht bewertete Kategorien, solange nichts gewählt ist', async () => {
    rendern({ werte: { ZEHN: '5', KLEIN: '' }, nichtBewertet: ['KLEIN', 'ZEHN'] })

    expect(screen.getByTestId('skill-KLEIN')).toHaveAccessibleDescription('Noch nicht bewertet.')
    // Eine Kategorie mit Wert braucht den Hinweis nicht, auch wenn sie in der Liste steht.
    expect(screen.getByTestId('skill-ZEHN')).not.toHaveAccessibleDescription('Noch nicht bewertet.')
  })

  test('der Satz zur Vorbelegung steht nur auf Verlangen da', () => {
    rendern()
    expect(screen.queryByTestId('skill-vorbelegt-hinweis')).not.toBeInTheDocument()
  })

  test('mit Vorbelegung bittet der Satz, jeden Wert zu prüfen', () => {
    rendern({ vorbelegtHinweis: true })

    expect(screen.getByTestId('skill-vorbelegt-hinweis')).toHaveTextContent('Bitte prüfe jeden Wert.')
  })

  test('schreibgeschützt, solange gesendet wird: die Wahl meldet nichts', async () => {
    const beiAenderung = rendern({ schreibgeschuetzt: true })

    await userEvent.click(screen.getByTestId('skill-KLEIN-3'))

    expect(beiAenderung).not.toHaveBeenCalled()
  })

  test('die Skala kommt aus den Daten: eine andere Grenze ergibt andere Stufen', () => {
    rendern({
      kategorien: [{ schluessel: 'X', bezeichnung: 'Xwert', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 6 }],
      werte: { X: '3' },
    })

    expect(within(screen.getByTestId('skill-X')).getAllByRole('radio')).toHaveLength(7)
    expect(screen.getByTestId('skill-X-3')).toBeChecked()
  })
})
