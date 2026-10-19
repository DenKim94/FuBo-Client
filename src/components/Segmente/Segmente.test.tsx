import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import Segmente, { type SegmentOption } from './Segmente'

const optionen: SegmentOption[] = [
  { wert: '1', text: 'Mo', lesetext: 'Montag' },
  { wert: '2', text: 'Di', lesetext: 'Dienstag' },
  { wert: '3', text: 'Mi', lesetext: 'Mittwoch' },
]

function rendern(teil: Partial<Parameters<typeof Segmente>[0]> = {}) {
  const beiAenderung = vi.fn()
  render(
    <Segmente
      legende="Wochentag"
      optionen={optionen}
      wert=""
      beiAenderung={beiAenderung}
      data-testid="tage"
      {...teil}
    />,
  )
  return beiAenderung
}

describe('Segmente', () => {
  test('ist eine benannte Gruppe mit einem Radio je Option', () => {
    rendern()

    const gruppe = screen.getByRole('group', { name: 'Wochentag' })
    expect(within(gruppe).getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByTestId('tage')).toBe(gruppe)
    expect(screen.getByTestId('tage-2')).toHaveAttribute('value', '2')
  })

  test('ohne Wert ist nichts gewählt', () => {
    rendern()

    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
  })

  test('der gewählte Wert ist angehakt, genau einer', () => {
    rendern({ wert: '2' })

    expect(screen.getByTestId('tage-2')).toBeChecked()
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
  })

  test('der Screenreader hört den vollen Namen, wo es einen gibt', () => {
    rendern()

    expect(screen.getByRole('radio', { name: 'Montag' })).toBe(screen.getByTestId('tage-1'))
    expect(screen.getByRole('radio', { name: 'Mittwoch' })).toBe(screen.getByTestId('tage-3'))
  })

  test('ohne Lesetext ist der sichtbare Text der Name', () => {
    rendern({ optionen: [{ wert: 'a', text: 'Serie' }] })

    expect(screen.getByRole('radio', { name: 'Serie' })).toBeInTheDocument()
  })

  test('meldet die Wahl mit dem Wert der Option', async () => {
    const beiAenderung = rendern()

    await userEvent.click(screen.getByTestId('tage-3'))

    expect(beiAenderung).toHaveBeenCalledTimes(1)
    expect(beiAenderung).toHaveBeenCalledWith('3')
  })

  test('die Pfeiltasten wählen das nächste Segment', async () => {
    const beiAenderung = rendern({ wert: '1' })
    screen.getByTestId('tage-1').focus()

    await userEvent.keyboard('{ArrowRight}')

    expect(beiAenderung).toHaveBeenCalledWith('2')
  })

  test('schreibgeschützt meldet nichts', async () => {
    const beiAenderung = rendern({ schreibgeschuetzt: true })

    await userEvent.click(screen.getByTestId('tage-2'))

    expect(beiAenderung).not.toHaveBeenCalled()
  })

  test('Hinweis und Fehler hängen als Beschreibung an der Gruppe', () => {
    rendern({ hinweis: 'Noch nicht bewertet.', fehler: 'Bitte wählen.' })

    const gruppe = screen.getByTestId('tage')
    expect(gruppe).toHaveAccessibleDescription('Noch nicht bewertet. Bitte wählen.')
    expect(gruppe).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('tage-fehler')).toHaveTextContent('Bitte wählen.')
  })

  test('ohne Hinweis und Fehler gibt es weder Beschreibung noch Ungültig-Marke', () => {
    rendern()

    const gruppe = screen.getByTestId('tage')
    expect(gruppe).not.toHaveAttribute('aria-describedby')
    expect(gruppe).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByTestId('tage-fehler')).not.toBeInTheDocument()
  })

  test('die Legende darf mehr als Text sein und bleibt Teil des Namens', () => {
    rendern({
      legende: (
        <>
          <span>Angriff</span> <span>4</span>
        </>
      ),
    })

    expect(screen.getByRole('group', { name: 'Angriff 4' })).toBeInTheDocument()
  })

  test('die versteckte Legende bleibt für Screenreader erhalten', () => {
    rendern({ legendeVersteckt: true })

    expect(screen.getByRole('group', { name: 'Wochentag' })).toBeInTheDocument()
    expect(screen.getByText('Wochentag')).toHaveClass('nurFuerScreenreader')
    // Nur die globale Klasse: Die Modulklasse setzte die volle Breite, je nach Reihenfolge der Stylesheets mit Überhang.
    expect(screen.getByText('Wochentag').className).toBe('nurFuerScreenreader')
  })

  test('jede Gruppe hat einen eigenen Radio-Namen, damit sich zwei Gruppen nicht gegenseitig abwählen', () => {
    render(
      <>
        <Segmente legende="A" optionen={optionen} wert="1" beiAenderung={() => {}} data-testid="a" />
        <Segmente legende="B" optionen={optionen} wert="2" beiAenderung={() => {}} data-testid="b" />
      </>,
    )

    expect(screen.getByTestId('a-1').getAttribute('name')).not.toBe(screen.getByTestId('b-1').getAttribute('name'))
    expect(screen.getByTestId('a-1')).toBeChecked()
    expect(screen.getByTestId('b-2')).toBeChecked()
  })
})
