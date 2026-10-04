import { fireEvent, render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import type { SitzungZustand } from '@/hooks/useSitzung'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AppLayout from './AppLayout'

// Ob eine Anmeldung besteht, bestimmt der Test; `useSitzung` selbst hat einen
// eigenen. Abmelden laeuft dagegen echt gegen den Mock-Server.
const sitzungMock = vi.fn<() => SitzungZustand>()
vi.mock('@/hooks/useSitzung', () => ({ useSitzung: () => sitzungMock() }))

/** Zustand ohne Sitzung (Vorgabe) mit den Abweichungen des Falls. */
function zustand(teil: Partial<SitzungZustand> = {}): SitzungZustand {
  return {
    laedt: false,
    sitzung: null,
    angemeldet: false,
    pinGeprueft: false,
    istAdmin: false,
    istGast: false,
    ...teil,
  }
}

/**
 * Baut einen Speicher-Router mit dem Layout als Rahmen.
 *
 * @param eintraege Verlauf des Routers; der letzte Eintrag ist die aktuelle Ansicht.
 */
function layoutRendern(...eintraege: string[]) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <p>Start</p> },
          { path: 'anmelden', element: <p>Anmeldung</p> },
          { path: 'pin/pruefen', element: <p>PIN-Eingabe</p>, handle: { ohneZurueck: true } },
          { path: 'termine', element: <p>Termine</p> },
          { path: 'teams', element: <p>Teams</p> },
          { path: 'ergebnis', element: <p>Ergebnis</p>, handle: { zurueck: '/teams' } },
        ],
      },
    ],
    { initialEntries: eintraege, initialIndex: eintraege.length - 1 },
  )
  return render(
    <QueryUmgebung>
      <RouterProvider router={router} />
    </QueryUmgebung>,
  )
}

/**
 * Setzt den Verlaufszaehler, den React Router im Browser in `history.state`
 * schreibt. Der Speicher-Router fasst `window.history` nicht an; das Layout
 * liest den Zaehler aber von dort, um den Direkteinstieg zu erkennen.
 */
function verlaufsindexSetzen(idx: number | null) {
  window.history.replaceState(idx === null ? null : { idx }, '')
}

beforeEach(() => sitzungMock.mockReturnValue(zustand()))

afterEach(() => {
  verlaufsindexSetzen(null)
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('AppLayout', () => {
  test('zeigt auf der Startseite keine Zurueck-Schaltflaeche', () => {
    layoutRendern('/')
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.queryByTestId('layout-zurueck')).not.toBeInTheDocument()
    // Ohne Schaltflaeche keine leere Kopfzeile, die Hoehe kostet.
    expect(screen.queryByTestId('layout-kopf')).not.toBeInTheDocument()
  })

  test('zeigt auf einer Unterseite eine Zurueck-Schaltflaeche', () => {
    layoutRendern('/anmelden')
    expect(screen.getByTestId('layout-zurueck')).toBeInTheDocument()
  })

  test('blendet die Zurueck-Schaltflaeche aus, wenn die Route sie abbestellt', () => {
    // Login-Schritte: Hinter der PIN-Eingabe gibt es kein sinnvolles Zurueck.
    layoutRendern('/pin/pruefen')
    expect(screen.getByText('PIN-Eingabe')).toBeInTheDocument()
    expect(screen.queryByTestId('layout-zurueck')).not.toBeInTheDocument()
  })

  test('geht innerhalb der Anwendung einen Schritt zurueck', async () => {
    verlaufsindexSetzen(1)
    layoutRendern('/anmelden', '/termine')

    fireEvent.click(screen.getByTestId('layout-zurueck'))

    expect(await screen.findByText('Anmeldung')).toBeInTheDocument()
  })

  test('fuehrt beim Direkteinstieg zur Startseite statt aus der Anwendung hinaus', async () => {
    verlaufsindexSetzen(0)
    layoutRendern('/termine')

    fireEvent.click(screen.getByTestId('layout-zurueck'))

    expect(await screen.findByText('Start')).toBeInTheDocument()
  })

  test('fuehrt zur uebergeordneten Ansicht aus handle statt einen Schritt zurueck', async () => {
    // Im Verlauf liegt davor die Anmeldung; mit `-1` landete man dort. Die
    // Zielangabe der Route fuehrt stattdessen zur Teamansicht.
    verlaufsindexSetzen(1)
    layoutRendern('/anmelden', '/ergebnis')

    fireEvent.click(screen.getByTestId('layout-zurueck'))

    expect(await screen.findByText('Teams')).toBeInTheDocument()
  })
  describe('Abmelden', () => {
    test('zeigt ohne Anmeldung keine Abmelden-Schaltflaeche', () => {
      // Login-Schritte und Admin-Anmeldung: Es gibt nichts abzumelden.
      layoutRendern('/anmelden')
      expect(screen.queryByTestId('layout-abmelden')).not.toBeInTheDocument()
    })

    test('zeigt auch in der Stufe PIN_VERIFIED keine Abmelden-Schaltflaeche', () => {
      sitzungMock.mockReturnValue(zustand({ pinGeprueft: true }))
      layoutRendern('/anmelden')
      expect(screen.queryByTestId('layout-abmelden')).not.toBeInTheDocument()
    })

    test('zeigt auf der Startseite Abmelden ohne Zurueck', () => {
      sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
      layoutRendern('/')

      // Die Kopfzeile erscheint, weil sie jetzt etwas traegt.
      expect(screen.getByTestId('layout-kopf')).toBeInTheDocument()
      expect(screen.getByTestId('layout-abmelden')).toHaveTextContent('Abmelden')
      expect(screen.queryByTestId('layout-zurueck')).not.toBeInTheDocument()
    })

    test('zeigt auf einer Unterseite Zurueck und Abmelden', () => {
      sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
      layoutRendern('/termine')

      expect(screen.getByTestId('layout-zurueck')).toBeInTheDocument()
      expect(screen.getByTestId('layout-abmelden')).toBeInTheDocument()
    })

    test('beendet die Sitzung auf dem Server und fuehrt zur PIN-Eingabe', async () => {
      sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
      const beenden = vi.fn()
      mockServer.use(
        http.post('*/auth/session/beenden', () => {
          beenden()
          return new HttpResponse(null, { status: 204 })
        }),
      )
      // Den Rueckruf des Sitzungsendes setzt der `SitzungsWaechter` im Layout:
      // Er fuehrt zur PIN-Eingabe. Das ist hier die sichtbare Wirkung.
      layoutRendern('/')

      fireEvent.click(screen.getByTestId('layout-abmelden'))

      expect(await screen.findByText('PIN-Eingabe')).toBeInTheDocument()
      expect(beenden).toHaveBeenCalledTimes(1)
    })

    test('bleibt angemeldet und nennt den Grund, wenn das Abmelden scheitert', async () => {
      sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
      mockServer.use(
        http.post('*/auth/session/beenden', () =>
          problem(500, 'INTERNER_FEHLER', 'Beim Abmelden ist etwas schiefgelaufen.'),
        ),
      )
      layoutRendern('/')

      fireEvent.click(screen.getByTestId('layout-abmelden'))

      expect(await screen.findByTestId('layout-abmelden-fehler')).toBeInTheDocument()
      // Kein Wechsel zur PIN-Eingabe: Die Person ist weiter angemeldet.
      expect(screen.getByText('Start')).toBeInTheDocument()
      expect(screen.queryByText('PIN-Eingabe')).not.toBeInTheDocument()
      // Die Schaltflaeche ist wieder bedienbar: nochmal versuchen.
      expect(screen.getByTestId('layout-abmelden')).toBeEnabled()
    })
  })
})
