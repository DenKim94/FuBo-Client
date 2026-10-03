import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import Auswahlliste, { type AuswahlOption } from './Auswahlliste'

const OPTIONEN: AuswahlOption[] = [
  { wert: 'gast', text: 'Gast', zusatz: 'ohne eigenes Profil' },
  { wert: '11', text: 'Beispielspieler 01' },
  { wert: '12', text: 'Beispielspieler 02', zusatz: 'bereits angemeldet', deaktiviert: true },
  { wert: '13', text: 'Beispielspieler 03' },
]

/** Gesteuerte Liste mit eigenem Zustand, wie in einer Ansicht. */
function Gesteuert({ beiAenderung = () => {} }: { beiAenderung?: (wert: string) => void }) {
  const [wert, setWert] = useState('')
  return (
    <>
      <Auswahlliste
        beschriftung="Dein Name"
        hinweis="Ausgegraute Namen sind angemeldet."
        optionen={OPTIONEN}
        wert={wert}
        beiAenderung={(w) => {
          setWert(w)
          beiAenderung(w)
        }}
      />
      <button type="button">Ausserhalb</button>
    </>
  )
}

/** Der Auslöser der Liste. */
const ausloeser = () => screen.getByRole('combobox', { name: 'Dein Name' })

describe('Auswahlliste', () => {
  test('ist eine beschriftete, geschlossene Combobox mit Hinweis', () => {
    render(<Gesteuert />)
    expect(ausloeser()).toHaveAttribute('aria-expanded', 'false')
    expect(ausloeser()).toHaveTextContent('Bitte wählen')
    expect(ausloeser()).toHaveAccessibleDescription('Ausgegraute Namen sind angemeldet.')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('oeffnet per Tipp, uebernimmt einen Eintrag und schliesst', () => {
    const aenderung = vi.fn()
    render(<Gesteuert beiAenderung={aenderung} />)

    fireEvent.click(ausloeser())
    expect(ausloeser()).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('option', { name: 'Beispielspieler 03' }))

    expect(aenderung).toHaveBeenCalledWith('13')
    expect(ausloeser()).toHaveAttribute('aria-expanded', 'false')
    expect(ausloeser()).toHaveTextContent('Beispielspieler 03')

    fireEvent.click(ausloeser())
    expect(screen.getByRole('option', { name: 'Beispielspieler 03' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('laesst gesperrte Eintraege nicht waehlen und nennt den Grund', () => {
    const aenderung = vi.fn()
    render(<Gesteuert beiAenderung={aenderung} />)
    fireEvent.click(ausloeser())

    // Der Grund steht im Namen des Eintrags – nicht nur in der grauen Farbe.
    const gesperrt = screen.getByRole('option', { name: 'Beispielspieler 02, bereits angemeldet' })
    expect(gesperrt).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(gesperrt)
    expect(aenderung).not.toHaveBeenCalled()
    expect(ausloeser()).toHaveAttribute('aria-expanded', 'true')
  })

  test('ist vollstaendig per Tastatur bedienbar und ueberspringt gesperrte Eintraege', () => {
    const aenderung = vi.fn()
    render(<Gesteuert beiAenderung={aenderung} />)
    const knopf = ausloeser()
    const aktiverText = () =>
      document.getElementById(knopf.getAttribute('aria-activedescendant') ?? '')?.textContent

    fireEvent.keyDown(knopf, { key: 'ArrowDown' })
    expect(knopf).toHaveAttribute('aria-expanded', 'true')
    expect(aktiverText()).toContain('Gast')

    fireEvent.keyDown(knopf, { key: 'ArrowDown' })
    expect(aktiverText()).toBe('Beispielspieler 01')
    fireEvent.keyDown(knopf, { key: 'ArrowDown' })
    // Beispielspieler 02 ist belegt und wird uebersprungen.
    expect(aktiverText()).toBe('Beispielspieler 03')

    fireEvent.keyDown(knopf, { key: 'Enter' })
    expect(aenderung).toHaveBeenCalledWith('13')
    expect(knopf).toHaveAttribute('aria-expanded', 'false')
  })

  test('schliesst mit Escape ohne Aenderung', () => {
    const aenderung = vi.fn()
    render(<Gesteuert beiAenderung={aenderung} />)
    fireEvent.keyDown(ausloeser(), { key: 'ArrowDown' })
    fireEvent.keyDown(ausloeser(), { key: 'Escape' })
    expect(ausloeser()).toHaveAttribute('aria-expanded', 'false')
    expect(aenderung).not.toHaveBeenCalled()
  })

  test('springt per Anfangsbuchstabe zum passenden Eintrag', () => {
    render(<Gesteuert />)
    const knopf = ausloeser()
    fireEvent.keyDown(knopf, { key: 'b' })
    expect(knopf).toHaveAttribute('aria-expanded', 'true')
    const aktiv = document.getElementById(knopf.getAttribute('aria-activedescendant') ?? '')
    expect(aktiv).toHaveTextContent('Beispielspieler 01')
  })

  test('schliesst bei einem Tipp ausserhalb', () => {
    render(<Gesteuert />)
    fireEvent.click(ausloeser())
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Ausserhalb' }))
    expect(ausloeser()).toHaveAttribute('aria-expanded', 'false')
  })

  test('laesst sich als Ganzes sperren', () => {
    render(
      <Auswahlliste beschriftung="Name" optionen={OPTIONEN} wert="" beiAenderung={() => {}} deaktiviert />,
    )
    expect(screen.getByRole('combobox', { name: 'Name' })).toBeDisabled()
  })
})
