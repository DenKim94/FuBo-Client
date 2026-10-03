import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import Namensauswahl from './Namensauswahl'

/** Rendert die Ansicht und wartet, bis die Namensliste geladen ist. */
async function rendernUndLaden() {
  render(
    <QueryUmgebung>
      <Namensauswahl />
    </QueryUmgebung>,
  )
  return screen.findByTestId('namensauswahl-liste')
}

/** Öffnet die Liste und wählt einen Eintrag über seinen Wert. */
function waehlen(wert: string) {
  fireEvent.click(screen.getByTestId('namensauswahl-liste'))
  fireEvent.click(screen.getByTestId(`namensauswahl-liste-option-${wert}`))
}

/** Fängt den Rumpf der nächsten Anfrage an einen Endpunkt ab. */
function rumpfAbfangen(pfad: string) {
  const gefangen: { rumpf?: unknown } = {}
  mockServer.use(
    http.post(pfad, async ({ request }) => {
      gefangen.rumpf = await request.json()
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return gefangen
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('Namensauswahl', () => {
  test('zeigt waehrend des Ladens den Spinner', () => {
    render(
      <QueryUmgebung>
        <Namensauswahl />
      </QueryUmgebung>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Namen werden geladen')
  })

  test('bietet Gast und alle Namen an und graut belegte aus – auch im Text', async () => {
    await rendernUndLaden()
    fireEvent.click(screen.getByTestId('namensauswahl-liste'))
    expect(screen.getByRole('option', { name: 'Gast, ohne eigenes Profil' })).not.toHaveAttribute(
      'aria-disabled',
    )
    expect(screen.getByRole('option', { name: 'Beispielspieler 01' })).not.toHaveAttribute(
      'aria-disabled',
    )
    // A6: nicht waehlbar, und die Aussage haengt nicht an der Farbe.
    expect(
      screen.getByRole('option', { name: 'Beispielspieler 02, bereits angemeldet' }),
    ).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('namensauswahl-absenden')).toBeDisabled()
  })

  test('sendet fuer einen Namen die Id und nennt ihn auf der Schaltflaeche', async () => {
    const gefangen = rumpfAbfangen('*/auth/user/waehlen')
    await rendernUndLaden()

    waehlen('13')
    const knopf = screen.getByTestId('namensauswahl-absenden')
    expect(knopf).toHaveTextContent('Weiter als Beispielspieler 03')
    fireEvent.click(knopf)

    await waitFor(() => expect(gefangen.rumpf).toEqual({ spielerId: 13 }))
  })

  test('sperrt das Absenden, wenn der gewaehlte Name zwischenzeitlich belegt wird', async () => {
    let belegt = false
    mockServer.use(
      http.get('*/auth/users/lesen', () =>
        HttpResponse.json([{ id: 11, name: 'Beispielspieler 01', belegt }]),
      ),
    )
    await rendernUndLaden()
    waehlen('11')
    expect(screen.getByTestId('namensauswahl-absenden')).toBeEnabled()

    // Naechster Polling-Takt: Jemand anderes hat sich unter dem Namen angemeldet.
    belegt = true
    await act(() => queryClient.invalidateQueries({ queryKey: schluessel.namensliste }))

    expect(await screen.findByRole('alert')).toHaveTextContent('ist bereits angemeldet')
    expect(screen.getByTestId('namensauswahl-absenden')).toBeDisabled()
  })

  test('zeigt bei NAME_BELEGT den Text des Servers', async () => {
    mockServer.use(
      http.post('*/auth/user/waehlen', () =>
        problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits angemeldet.'),
      ),
    )
    await rendernUndLaden()
    waehlen('11')
    fireEvent.click(screen.getByTestId('namensauswahl-absenden'))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dieser Name ist bereits angemeldet.')
  })

  test('zeigt fuer Gaeste Name, Stufe und Erklaerung und haengt „(Gast)" nur an', async () => {
    const gefangen = rumpfAbfangen('*/auth/gast/anmelden')
    await rendernUndLaden()

    waehlen('gast')
    expect(screen.getByTestId('namensauswahl-gast')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Was bedeutet Gast?' })).toBeInTheDocument()
    // Vorbelegung laut Kontrakt und A17.
    expect(screen.getByRole('radio', { name: 'Mittel' })).toBeChecked()
    expect(screen.getByTestId('namensauswahl-absenden')).toBeDisabled()

    fireEvent.change(screen.getByTestId('gast-name'), { target: { value: '  Testgast ' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Stark' }))
    const knopf = screen.getByTestId('namensauswahl-absenden')
    expect(knopf).toHaveTextContent('Weiter als Testgast (Gast)')
    fireEvent.click(knopf)

    // Gesendet wird der bereinigte Name ohne den Zusatz.
    await waitFor(() => expect(gefangen.rumpf).toEqual({ gastName: 'Testgast', stufe: 'STARK' }))
  })

  test('verlangt fuer Gaeste mindestens zwei Zeichen', async () => {
    await rendernUndLaden()
    waehlen('gast')
    fireEvent.change(screen.getByTestId('gast-name'), { target: { value: ' T ' } })
    expect(screen.getByTestId('namensauswahl-absenden')).toBeDisabled()
  })

  test('zeigt einen vergebenen Gastnamen am Feld', async () => {
    mockServer.use(
      http.post('*/auth/gast/anmelden', () =>
        problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.'),
      ),
    )
    await rendernUndLaden()
    waehlen('gast')
    fireEvent.change(screen.getByTestId('gast-name'), { target: { value: 'Testgast' } })
    fireEvent.click(screen.getByTestId('namensauswahl-absenden'))

    // Die Oberflaeche weiss, welches Feld gemeint ist – der Text bleibt der des Servers.
    expect(await screen.findByTestId('gast-name-fehler')).toHaveTextContent(
      'Dieser Name ist bereits vergeben.',
    )
    expect(screen.getByTestId('gast-name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByTestId('namensauswahl-meldung')).not.toBeInTheDocument()
  })

  test('meldet volle Gastplaetze im Fehlerkasten', async () => {
    mockServer.use(
      http.post('*/auth/gast/anmelden', () =>
        problem(409, 'KEIN_GAST_SLOT_FREI', 'Es sind bereits alle Gastplätze belegt.'),
      ),
    )
    await rendernUndLaden()
    waehlen('gast')
    fireEvent.change(screen.getByTestId('gast-name'), { target: { value: 'Testgast' } })
    fireEvent.click(screen.getByTestId('namensauswahl-absenden'))

    expect(await screen.findByTestId('namensauswahl-meldung')).toHaveTextContent(
      'Es sind bereits alle Gastplätze belegt.',
    )
  })

  test('bietet bei einem Ladefehler einen neuen Versuch an', async () => {
    let versuche = 0
    mockServer.use(
      http.get('*/auth/users/lesen', () => {
        versuche += 1
        // Erster Abruf und der automatische zweite Versuch scheitern.
        return versuche <= 2
          ? problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.')
          : HttpResponse.json([])
      }),
    )
    render(
      <QueryUmgebung>
        <Namensauswahl />
      </QueryUmgebung>,
    )
    // Die Wiederholungsregel versucht einen 500 einmal selbst – erst danach steht der Fehler.
    const erneut = await screen.findByTestId('namensauswahl-ladefehler-erneut', {}, { timeout: 4000 })
    expect(screen.getByRole('alert')).toHaveTextContent('Unerwarteter Fehler.')

    fireEvent.click(erneut)
    // Leere Liste: Hinweis auf den Gastzugang statt einer leeren Auswahl.
    expect(await screen.findByText(/Du kannst als Gast teilnehmen/)).toBeInTheDocument()
  })
})
