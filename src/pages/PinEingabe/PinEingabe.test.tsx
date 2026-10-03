import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import PinEingabe from './PinEingabe'

/** Rendert die Ansicht mit dem echten Query-Client und einem Router für den Admin-Link. */
function rendern() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PinEingabe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** Tippt eine PIN in das native Feld. */
function eintippen(pin: string) {
  fireEvent.change(screen.getByTestId('pin-feld'), { target: { value: pin } })
}

/** Antwort des Servers bei gesperrter PIN-Prüfung. */
function sperrAntwort(wartesekunden: number) {
  return HttpResponse.json(
    {
      type: 'about:blank',
      status: 429,
      code: 'PIN_GESPERRT',
      detail: `Zu viele Fehlversuche. Bitte in ${wartesekunden} Sekunden erneut versuchen.`,
      wartesekunden,
    },
    { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('PinEingabe', () => {
  test('bietet ein beschriftetes natives Feld mit Zifferntastatur an', () => {
    rendern()
    const feld = screen.getByLabelText('Eingabe der zentralen PIN')
    // Kein nachgebauter Ziffernblock: Das Geraet zeigt seine eigene Tastatur.
    expect(feld).toHaveAttribute('inputmode', 'numeric')
    expect(feld).toHaveAttribute('type', 'text')
    expect(feld).toHaveFocus()
    expect(feld).toHaveAccessibleDescription('Die PIN erhältst du von den Admins.')
  })

  test('zeigt vier Kaestchen und fuellt sie mit der Eingabe', () => {
    rendern()
    expect(screen.getAllByTestId('pin-kasten')).toHaveLength(4)

    eintippen('12')

    const gefuellt = screen
      .getAllByTestId('pin-kasten')
      .filter((k) => k.getAttribute('data-gefuellt') === 'true')
    expect(gefuellt).toHaveLength(2)
  })

  test('begrenzt die Eingabe auf vier Zeichen und vier Kaestchen', () => {
    // Die zentrale PIN ist vierstellig; mehr Kaestchen als Ziffern gibt es nicht.
    rendern()
    const feld = screen.getByTestId('pin-feld')
    expect(feld).toHaveAttribute('maxlength', '4')
    eintippen('1234')
    expect(screen.getAllByTestId('pin-kasten')).toHaveLength(4)
    expect(
      screen.getAllByTestId('pin-kasten').filter((k) => k.getAttribute('data-gefuellt') === 'true'),
    ).toHaveLength(4)
  })

  test('sperrt „Zutritt", solange nichts eingegeben ist', () => {
    rendern()
    expect(screen.getByTestId('pin-absenden')).toBeDisabled()
    eintippen('1')
    expect(screen.getByTestId('pin-absenden')).toBeEnabled()
  })

  test('schickt die PIN beim Absenden an den Server', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/auth/pin/pruefen', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    rendern()
    eintippen('4711')

    fireEvent.submit(screen.getByTestId('pin-eingabe'))

    await waitFor(() => expect(gesendet).toEqual({ pin: '4711' }))
  })

  test('zeigt bei falscher PIN den Servertext, leert das Feld und behaelt den Fokus', async () => {
    mockServer.use(
      http.post('*/auth/pin/pruefen', () => problem(401, 'PIN_FALSCH', 'Die PIN ist nicht korrekt.')),
    )
    rendern()
    eintippen('9999')

    fireEvent.submit(screen.getByTestId('pin-eingabe'))

    // Der Text des Servers, nicht eine eigene Fassung im Client.
    expect(await screen.findByRole('alert')).toHaveTextContent('Die PIN ist nicht korrekt.')
    const feld = screen.getByTestId('pin-feld')
    expect(feld).toHaveValue('')
    expect(feld).toHaveFocus()
    expect(feld).toHaveAttribute('aria-invalid', 'true')
  })

  test('behaelt die PIN, wenn gar keine Antwort kam', async () => {
    mockServer.use(http.post('*/auth/pin/pruefen', () => HttpResponse.error()))
    rendern()
    eintippen('1234')

    fireEvent.submit(screen.getByTestId('pin-eingabe'))

    // Ohne Antwort war die PIN nicht falsch – sie muss nicht neu getippt werden.
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Server ist nicht erreichbar.')
    expect(screen.getByTestId('pin-feld')).toHaveValue('1234')
  })

  test('sperrt „Zutritt" fuer die Wartezeit des Servers und gibt es danach frei', async () => {
    mockServer.use(http.post('*/auth/pin/pruefen', () => sperrAntwort(1)))
    rendern()
    eintippen('9999')

    fireEvent.submit(screen.getByTestId('pin-eingabe'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Zu viele Fehlversuche.')

    eintippen('1234')
    expect(screen.getByTestId('pin-absenden')).toBeDisabled()

    // Nach Ablauf: wieder frei, und die Meldung mit der veralteten Zeitangabe ist weg.
    await waitFor(() => expect(screen.getByTestId('pin-absenden')).toBeEnabled(), { timeout: 2500 })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('verlinkt die Admin-Anmeldung', () => {
    rendern()
    expect(screen.getByRole('link', { name: 'Als Admin anmelden' })).toHaveAttribute(
      'href',
      '/admin/anmelden',
    )
  })
})
