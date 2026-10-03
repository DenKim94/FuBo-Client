import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import Dialog from './Dialog'

/**
 * jsdom implementiert weder `showModal` noch `close` (Stub in `src/test/setup.ts`)
 * und rendert kein CSS: Der Inhalt steht auch geschlossen im Baum. Geprueft wird
 * deshalb `dialog.open`, nicht die Auffindbarkeit. Fokusfalle, Inertisierung und
 * `::backdrop` gehoeren in einen Browser-Test.
 */
function dialogElement(testId = 'dialog'): HTMLDialogElement {
  return screen.getByTestId(testId) as HTMLDialogElement
}

describe('Dialog', () => {
  test('oeffnet und schliesst ueber die Eigenschaft offen', () => {
    const aufSchliessen = vi.fn()
    const { rerender } = render(
      <Dialog offen={false} titel="Sitzung läuft ab" aufSchliessen={aufSchliessen}>
        <p>Inhalt</p>
      </Dialog>,
    )
    expect(dialogElement().open).toBe(false)

    rerender(
      <Dialog offen titel="Sitzung läuft ab" aufSchliessen={aufSchliessen}>
        <p>Inhalt</p>
      </Dialog>,
    )
    expect(dialogElement().open).toBe(true)

    rerender(
      <Dialog offen={false} titel="Sitzung läuft ab" aufSchliessen={aufSchliessen}>
        <p>Inhalt</p>
      </Dialog>,
    )
    expect(dialogElement().open).toBe(false)
    // Das `close`-Ereignis meldet das Schliessen auch beim gesteuerten Weg.
    expect(aufSchliessen).toHaveBeenCalledTimes(1)
  })

  test('traegt den Titel als zugaenglichen Namen, auch bei zwei Dialogen ohne ID-Kollision', () => {
    render(
      <>
        <Dialog offen titel="Erster" aufSchliessen={() => {}} data-testid="dialog-eins">
          <p>A</p>
        </Dialog>
        <Dialog offen titel="Zweiter" aufSchliessen={() => {}} data-testid="dialog-zwei">
          <p>B</p>
        </Dialog>
      </>,
    )
    expect(screen.getByRole('dialog', { name: 'Erster' })).toBe(dialogElement('dialog-eins'))
    expect(screen.getByRole('dialog', { name: 'Zweiter' })).toBe(dialogElement('dialog-zwei'))
    expect(dialogElement('dialog-eins').getAttribute('aria-labelledby')).not.toBe(
      dialogElement('dialog-zwei').getAttribute('aria-labelledby'),
    )
  })

  test('meldet ein Schliessen durch den Nutzer ueber aufSchliessen', () => {
    const aufSchliessen = vi.fn()
    render(
      <Dialog offen titel="Hinweis" aufSchliessen={aufSchliessen}>
        <p>Inhalt</p>
      </Dialog>,
    )
    // Escape: erst `cancel` (abbrechbar), dann schliesst der Browser.
    const abbruch = new Event('cancel', { cancelable: true })
    fireEvent(dialogElement(), abbruch)
    expect(abbruch.defaultPrevented).toBe(false)

    dialogElement().close()
    expect(aufSchliessen).toHaveBeenCalledTimes(1)
  })

  test('weist Escape im Modus festhalten ab', () => {
    render(
      <Dialog offen festhalten titel="Ergebnis eintragen" aufSchliessen={() => {}}>
        <p>Inhalt</p>
      </Dialog>,
    )
    const abbruch = new Event('cancel', { cancelable: true })
    fireEvent(dialogElement(), abbruch)

    expect(abbruch.defaultPrevented).toBe(true)
    expect(dialogElement().open).toBe(true)
  })

  test('oeffnet sich im Modus festhalten wieder, wenn der Browser ihn trotzdem schliesst', () => {
    // Zweite Schliessanfrage ohne Nutzeraktivierung: `cancel` ist dann nicht
    // mehr abbrechbar, der Browser schliesst den Dialog selbst.
    const aufSchliessen = vi.fn()
    render(
      <Dialog offen festhalten titel="Ergebnis eintragen" aufSchliessen={aufSchliessen}>
        <p>Inhalt</p>
      </Dialog>,
    )

    dialogElement().close()

    expect(dialogElement().open).toBe(true)
    expect(aufSchliessen).not.toHaveBeenCalled()
  })

  test('schliesst im Modus festhalten ueber offen', () => {
    const aufSchliessen = vi.fn()
    const { rerender } = render(
      <Dialog offen festhalten titel="Ergebnis eintragen" aufSchliessen={aufSchliessen}>
        <p>Inhalt</p>
      </Dialog>,
    )
    rerender(
      <Dialog offen={false} festhalten titel="Ergebnis eintragen" aufSchliessen={aufSchliessen}>
        <p>Inhalt</p>
      </Dialog>,
    )
    expect(dialogElement().open).toBe(false)
    expect(aufSchliessen).toHaveBeenCalledTimes(1)
  })
})
