import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, delay, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useTermin } from '@/hooks/useTermin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import RueckmeldungLeiste from './RueckmeldungLeiste'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/**
 * Wie die Ansicht: Der Termin kommt aus der Abfrage, die Leiste bekommt die eigene
 * Rueckmeldung als Eigenschaft. Ohne diese Kopplung zeigte der Test nicht, ob die
 * Leiste nach dem Erfolg mit dem neuen Stand neu gezeichnet wird.
 */
function Rahmen() {
  const abfrage = useTermin(102, 60_000)
  if (!abfrage.data) return <p>laedt</p>
  return <RueckmeldungLeiste eigeneRueckmeldung={abfrage.data.eigeneRueckmeldung ?? null} terminId={102} />
}

function rendern(eigene: boolean | null = null) {
  const welt = terminHandlers([terminModell({ terminId: 102, eigene })])
  mockServer.use(...welt.handlers)
  render(<Rahmen />, { wrapper: QueryUmgebung })
  return welt
}

describe('RueckmeldungLeiste', () => {
  test('bietet bei null „Ich kann nicht“ und „Ich bin dabei“', async () => {
    rendern(null)
    expect(await screen.findByTestId('rueckmeldung-absagen')).toHaveTextContent('Ich kann nicht')
    expect(screen.getByTestId('rueckmeldung-zusagen')).toHaveTextContent('Ich bin dabei')
  })

  test('bietet bei true nur „Absagen“', async () => {
    rendern(true)
    expect(await screen.findByTestId('rueckmeldung-absagen')).toHaveTextContent('Absagen')
    expect(screen.queryByTestId('rueckmeldung-zusagen')).not.toBeInTheDocument()
  })

  test('bietet bei false nur „Doch zusagen“ – null ist nicht false', async () => {
    rendern(false)
    expect(await screen.findByTestId('rueckmeldung-zusagen')).toHaveTextContent('Doch zusagen')
    expect(screen.queryByTestId('rueckmeldung-absagen')).not.toBeInTheDocument()
  })

  test('sendet die Zusage ohne Hintergrundkopf und wechselt zur Absage-Aktion', async () => {
    const welt = rendern(null)
    await userEvent.click(await screen.findByTestId('rueckmeldung-zusagen'))

    await waitFor(() => expect(screen.queryByTestId('rueckmeldung-zusagen')).not.toBeInTheDocument())
    expect(screen.getByTestId('rueckmeldung-absagen')).toHaveTextContent('Absagen')
    expect(welt.protokoll.rueckmeldungen).toEqual([{ terminId: 102, zusage: true, kopf: null }])
  })

  test('legt den Fokus nach dem Erfolg auf die verbleibende Aktion', async () => {
    // Die gedrueckte Schaltflaeche entfaellt und nimmt den Fokus mit; ohne
    // Nachfuehrung landete er auf `body`.
    rendern(null)
    await userEvent.click(await screen.findByTestId('rueckmeldung-zusagen'))

    const absagen = await screen.findByRole('button', { name: 'Absagen' })
    await waitFor(() => expect(absagen).toHaveFocus())
  })

  test('sperrt waehrend des Sendens die andere Aktion per aria-disabled und behaelt ihren Fokus', async () => {
    mockServer.use(
      http.post('*/termine/rueckmeldung', async () => {
        await delay(150)
        return new HttpResponse(null, { status: 204 })
      }),
    )
    mockServer.use(...terminHandlers([terminModell({ terminId: 102 })]).handlers.slice(0, 2))
    render(<Rahmen />, { wrapper: QueryUmgebung })

    const zusagen = await screen.findByTestId('rueckmeldung-zusagen')
    const absagen = screen.getByTestId('rueckmeldung-absagen')
    await userEvent.click(zusagen)

    expect(zusagen).toHaveAttribute('aria-busy', 'true')
    // Nicht `disabled`: Der Fokus bliebe sonst nicht erreichbar.
    expect(absagen).toHaveAttribute('aria-disabled', 'true')
    expect(absagen).not.toBeDisabled()

    // Der Mock ist zustandslos: Nach dem Erfolg bleibt der Stand, die Sperre endet.
    await waitFor(() => expect(zusagen).not.toHaveAttribute('aria-busy', 'true'))
    expect(absagen).not.toHaveAttribute('aria-disabled')
  })

  test('zeigt einen Fehler ueber der Leiste und behaelt den Stand', async () => {
    mockServer.use(
      http.post('*/termine/rueckmeldung', () =>
        problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen. Eine Rückmeldung ist nicht mehr möglich.'),
      ),
      ...terminHandlers([terminModell({ terminId: 102 })]).handlers.slice(0, 2),
    )
    render(<Rahmen />, { wrapper: QueryUmgebung })
    await userEvent.click(await screen.findByTestId('rueckmeldung-zusagen'))

    expect(await screen.findByTestId('rueckmeldung-fehler')).toHaveTextContent('Der Termin ist geschlossen.')
    expect(screen.getByTestId('rueckmeldung-zusagen')).toBeInTheDocument()
    expect(screen.getByTestId('rueckmeldung-absagen')).not.toHaveAttribute('aria-disabled')
  })
})
