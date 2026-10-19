import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { HINWEIS_PIN_GEAENDERT } from '@/hooks/admin/usePinAendern'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminPin from './AdminPin'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

function rendern() {
  return render(
    <QueryUmgebung>
      <MemoryRouter>
        <AdminPin />
      </MemoryRouter>
    </QueryUmgebung>,
  )
}

/** Tippt die PIN ins Feld. */
function pinEingeben(pin: string) {
  fireEvent.change(screen.getByTestId('admin-pin-feld'), { target: { value: pin } })
}

/** Öffnet die Bestätigung. */
function dialogOeffnen(pin = '4711') {
  pinEingeben(pin)
  fireEvent.click(screen.getByTestId('admin-pin-absenden'))
}

describe('AdminPin', () => {
  test('zeigt Überschrift, Feld und gesperrte Schaltfläche mit Grund bis vier Ziffern', () => {
    rendern()

    expect(screen.getByRole('heading', { name: 'Zentrale PIN ändern' })).toBeInTheDocument()
    expect(screen.getByText('Die PIN wird zentral geändert. Dies wird alle laufenden Sitzungen beenden.')).toBeInTheDocument()
    expect(screen.getByTestId('admin-pin-feld')).toHaveAccessibleDescription('Bitte gib vier Ziffern ein.')
    const knopf = screen.getByTestId('admin-pin-absenden')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription('Bitte gib vier Ziffern ein.')
    // Sichtbar steht der Grund nur einmal (am Feld); der Satz am Knopf ist nur für den Screenreader.
    expect(screen.getByTestId('admin-pin-grund')).toHaveClass('nurFuerScreenreader')

    pinEingeben('471')
    expect(screen.getByTestId('admin-pin-grund')).toBeInTheDocument()
    pinEingeben('4711')
    expect(screen.queryByTestId('admin-pin-grund')).not.toBeInTheDocument()
    expect(knopf).not.toHaveAttribute('aria-disabled')
  })

  test('unvollständige PIN öffnet keinen Dialog', () => {
    rendern()

    pinEingeben('47')
    fireEvent.click(screen.getByTestId('admin-pin-absenden'))

    expect((screen.getByTestId('admin-pin-dialog') as HTMLDialogElement).open).toBe(false)
  })

  test('„PIN ändern“ öffnet erst die Bestätigung mit den Folgen, gesendet wird noch nichts', () => {
    let aufrufe = 0
    mockServer.use(
      http.post('*/admin/pin/aendern', () => {
        aufrufe += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    rendern()

    dialogOeffnen()

    const dialog = screen.getByTestId('admin-pin-dialog') as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(dialog).toHaveTextContent('Alle Angemeldeten werden sofort abgemeldet')
    expect(dialog).toHaveTextContent('Teile die neue PIN vorher oder direkt danach mit.')
    expect(dialog).not.toHaveTextContent('deinen Weg')
    expect(dialog).toHaveTextContent('auch Spieler und Gäste, und du selbst')
    expect(aufrufe).toBe(0)
  })

  test('Abbrechen schließt den Dialog, ohne zu senden; die Eingabe bleibt', async () => {
    let aufrufe = 0
    mockServer.use(
      http.post('*/admin/pin/aendern', () => {
        aufrufe += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )
    rendern()
    dialogOeffnen()

    await userEvent.click(screen.getByTestId('admin-pin-dialog-abbrechen'))

    expect((screen.getByTestId('admin-pin-dialog') as HTMLDialogElement).open).toBe(false)
    expect(screen.getByTestId('admin-pin-feld')).toHaveValue('4711')
    expect(aufrufe).toBe(0)
  })

  test('204: sendet die neue PIN und beendet die Sitzung mit Hinweis', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/admin/pin/aendern', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern()
    dialogOeffnen('4711')

    await userEvent.click(screen.getByTestId('admin-pin-dialog-bestaetigen'))

    await waitFor(() => expect(sitzungsende).toHaveBeenCalledExactlyOnceWith(HINWEIS_PIN_GEAENDERT))
    expect(gesendet).toEqual({ neuePin: '4711' })
  })

  test('400 mit felder.neuePin: Dialog schließt, Text steht am Feld', async () => {
    mockServer.use(
      http.post('*/admin/pin/aendern', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 400,
            code: 'EINGABE_UNGUELTIG',
            detail: 'Die Eingabe ist ungültig.',
            felder: { neuePin: 'Die PIN muss aus genau vier Ziffern bestehen.' },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    rendern()
    dialogOeffnen()

    await userEvent.click(screen.getByTestId('admin-pin-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-pin-feld-fehler')).toHaveTextContent(
      'Die PIN muss aus genau vier Ziffern bestehen.',
    )
    expect((screen.getByTestId('admin-pin-dialog') as HTMLDialogElement).open).toBe(false)
    await waitFor(() => expect(screen.getByTestId('admin-pin-feld')).toHaveFocus())
  })

  test('anderer Fehler (500): steht im Dialog, der Dialog bleibt offen, ein zweiter Tipp wiederholt', async () => {
    let aufrufe = 0
    mockServer.use(
      http.post('*/admin/pin/aendern', () => {
        aufrufe += 1
        return aufrufe === 1
          ? problem(500, 'INTERNER_FEHLER', 'Es ist ein interner Fehler aufgetreten.')
          : new HttpResponse(null, { status: 204 })
      }),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern()
    dialogOeffnen()

    await userEvent.click(screen.getByTestId('admin-pin-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-pin-dialog-fehler')).toHaveTextContent(
      'Es ist ein interner Fehler aufgetreten.',
    )
    expect((screen.getByTestId('admin-pin-dialog') as HTMLDialogElement).open).toBe(true)
    expect(sitzungsende).not.toHaveBeenCalled()

    await userEvent.click(screen.getByTestId('admin-pin-dialog-bestaetigen'))
    await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
    expect(aufrufe).toBe(2)
  })

  test('401 SESSION_UNGUELTIG: globale Behandlung', async () => {
    mockServer.use(
      http.post('*/admin/pin/aendern', () => problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.')),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern()
    dialogOeffnen()

    await userEvent.click(screen.getByTestId('admin-pin-dialog-bestaetigen'))

    await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
  })

  test('Netzfehler: Meldung im Dialog, Eingabe bleibt stehen', async () => {
    mockServer.use(http.post('*/admin/pin/aendern', () => HttpResponse.error()))
    rendern()
    dialogOeffnen()

    await userEvent.click(screen.getByTestId('admin-pin-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-pin-dialog-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('admin-pin-feld')).toHaveValue('4711')
  })
})
