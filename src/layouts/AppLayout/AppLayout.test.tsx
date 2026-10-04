import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import AppLayout from './AppLayout'

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
  return render(<RouterProvider router={router} />)
}

/**
 * Setzt den Verlaufszaehler, den React Router im Browser in `history.state`
 * schreibt. Der Speicher-Router fasst `window.history` nicht an; das Layout
 * liest den Zaehler aber von dort, um den Direkteinstieg zu erkennen.
 */
function verlaufsindexSetzen(idx: number | null) {
  window.history.replaceState(idx === null ? null : { idx }, '')
}

afterEach(() => verlaufsindexSetzen(null))

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
})
