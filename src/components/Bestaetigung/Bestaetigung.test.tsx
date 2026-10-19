import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import Bestaetigung from './Bestaetigung'

type Eigenschaften = Partial<Parameters<typeof Bestaetigung>[0]>

/** Rendert eine offene Bestätigung mit Spionen. */
function rendern(teil: Eigenschaften = {}) {
  const beiBestaetigen = vi.fn()
  const beiAbbruch = vi.fn()
  const ergebnis = render(
    <Bestaetigung
      offen
      titel="Termin absagen?"
      bestaetigenText="Termin absagen"
      art="gefahr"
      beiBestaetigen={beiBestaetigen}
      beiAbbruch={beiAbbruch}
      {...teil}
    >
      <p>Die Absage ist endgültig.</p>
    </Bestaetigung>,
  )
  return { ...ergebnis, beiBestaetigen, beiAbbruch }
}

describe('Bestaetigung', () => {
  test('zeigt Titel, die Folgen und die Bestaetigung mit dem Verb der Aktion', () => {
    rendern()

    const dialog = screen.getByTestId('bestaetigung') as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(screen.getByRole('heading', { name: 'Termin absagen?' })).toBeInTheDocument()
    expect(screen.getByText('Die Absage ist endgültig.')).toBeInTheDocument()
    expect(screen.getByTestId('bestaetigung-bestaetigen')).toHaveTextContent('Termin absagen')
    expect(screen.getByTestId('bestaetigung-abbrechen')).toHaveTextContent('Abbrechen')
  })

  test('beschreibt den Dialog durch die Folgen (aria-describedby)', () => {
    rendern()

    const dialog = screen.getByTestId('bestaetigung')
    const beschreibung = document.getElementById(dialog.getAttribute('aria-describedby') ?? '')
    expect(beschreibung).toHaveTextContent('Die Absage ist endgültig.')
  })

  test('ist geschlossen, solange offen false ist', () => {
    rendern({ offen: false })

    expect((screen.getByTestId('bestaetigung') as HTMLDialogElement).open).toBe(false)
  })

  test('bei Gefahr beginnt der Fokus auf „Abbrechen“', () => {
    rendern({ art: 'gefahr' })

    expect(screen.getByTestId('bestaetigung-abbrechen')).toHaveFocus()
  })

  test('bei einem Schritt ohne Gefahr beginnt der Fokus auf der Bestaetigung', () => {
    rendern({ art: 'primaer' })

    expect(screen.getByTestId('bestaetigung-bestaetigen')).toHaveFocus()
  })

  test('„akzent“ färbt die Bestätigung blau; ein endgültiger Schritt hält den Fokus trotzdem auf „Abbrechen“', () => {
    rendern({ art: 'akzent', fokusAufAbbrechen: true })

    expect(screen.getByTestId('bestaetigung-bestaetigen').className).toMatch(/akzent/)
    expect(screen.getByTestId('bestaetigung-bestaetigen').className).not.toMatch(/gefahr/)
    expect(screen.getByTestId('bestaetigung-abbrechen')).toHaveFocus()
  })

  test('„akzent“ ohne Angabe zum Fokus beginnt auf der Bestätigung', () => {
    rendern({ art: 'akzent' })

    expect(screen.getByTestId('bestaetigung-bestaetigen')).toHaveFocus()
  })

  test('setzt den Fokus beim nachtraeglichen Oeffnen, nicht nur beim ersten Rendern', () => {
    function Huelle() {
      const [offen, setOffen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOffen(true)} data-testid="auf">
            auf
          </button>
          <Bestaetigung offen={offen} titel="T" bestaetigenText="Tun" art="gefahr" beiBestaetigen={() => {}} beiAbbruch={() => setOffen(false)}>
            <p>Folgen</p>
          </Bestaetigung>
        </>
      )
    }
    render(<Huelle />)

    fireEvent.click(screen.getByTestId('auf'))

    expect(screen.getByTestId('bestaetigung-abbrechen')).toHaveFocus()
  })

  test('die Bestaetigung loest die Aktion aus und schliesst den Dialog nicht selbst', async () => {
    const { beiBestaetigen, beiAbbruch } = rendern()

    await userEvent.click(screen.getByTestId('bestaetigung-bestaetigen'))

    expect(beiBestaetigen).toHaveBeenCalledOnce()
    expect(beiAbbruch).not.toHaveBeenCalled()
    expect((screen.getByTestId('bestaetigung') as HTMLDialogElement).open).toBe(true)
  })

  test('„Abbrechen“ meldet den Abbruch', async () => {
    const { beiAbbruch, beiBestaetigen } = rendern()

    await userEvent.click(screen.getByTestId('bestaetigung-abbrechen'))

    expect(beiAbbruch).toHaveBeenCalledOnce()
    expect(beiBestaetigen).not.toHaveBeenCalled()
  })

  test('Escape schliesst den Dialog und meldet den Abbruch', () => {
    const { beiAbbruch } = rendern()
    const dialog = screen.getByTestId('bestaetigung') as HTMLDialogElement

    // Der Browser schliesst bei Escape: jsdom bildet das ueber `close()` nach.
    dialog.close()

    expect(beiAbbruch).toHaveBeenCalledOnce()
  })

  test('waehrend des Aufrufs: Spinner statt Beschriftung, „Abbrechen“ gesperrt, Escape abgewiesen', async () => {
    const { beiAbbruch, beiBestaetigen } = rendern({ laedt: true })

    const bestaetigen = screen.getByTestId('bestaetigung-bestaetigen')
    expect(bestaetigen).toBeDisabled()
    expect(bestaetigen).toHaveAttribute('aria-busy', 'true')
    const abbrechen = screen.getByTestId('bestaetigung-abbrechen')
    // `aria-disabled` statt `disabled`: Der Fokus bleibt, der Klick tut nichts.
    expect(abbrechen).toHaveAttribute('aria-disabled', 'true')
    expect(abbrechen).not.toBeDisabled()
    await userEvent.click(abbrechen)
    expect(beiAbbruch).not.toHaveBeenCalled()
    expect(beiBestaetigen).not.toHaveBeenCalled()

    const dialog = screen.getByTestId('bestaetigung')
    const cancel = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(cancel)
    expect(cancel.defaultPrevented).toBe(true)
  })

  test('oeffnet den Dialog wieder, wenn der Browser ihn waehrend des Aufrufs schliesst', () => {
    // Close Watcher (Chrome 122): `cancel` kann uebersprungen werden.
    const { beiAbbruch } = rendern({ laedt: true })
    const dialog = screen.getByTestId('bestaetigung') as HTMLDialogElement

    dialog.close()

    expect(dialog.open).toBe(true)
    expect(beiAbbruch).not.toHaveBeenCalled()
  })

  test('zeigt einen Fehler im Dialog, der Dialog bleibt offen', () => {
    rendern({ fehler: new ApiFehler(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist bereits abgesagt oder abgeschlossen.') })

    expect(screen.getByTestId('bestaetigung-fehler')).toHaveTextContent('Der Termin ist bereits abgesagt oder abgeschlossen.')
    expect((screen.getByTestId('bestaetigung') as HTMLDialogElement).open).toBe(true)
  })

  test('zeigt ohne Fehler keine Meldung', () => {
    rendern({ fehler: null })

    expect(screen.queryByTestId('bestaetigung-fehler')).not.toBeInTheDocument()
  })

  test('nutzt den Text des Aufrufers als Namen der Abbruchaktion und das Praefix der Test-IDs', () => {
    rendern({ abbrechenText: 'Zurück', 'data-testid': 'mein-dialog' })

    expect(screen.getByTestId('mein-dialog-abbrechen')).toHaveTextContent('Zurück')
    expect(screen.getByTestId('mein-dialog-bestaetigen')).toBeInTheDocument()
  })
})
