import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { SitzungZustand } from '@/hooks/useSitzung'
import LoginSchrittRoute from './LoginSchrittRoute'

const sitzungMock = vi.fn<() => SitzungZustand>()
vi.mock('@/hooks/useSitzung', () => ({ useSitzung: () => sitzungMock() }))

/** Baut einen Zustand mit sinnvollen Vorgaben (ohne Sitzung). */
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

/** Öffnet einen der beiden Login-Schritte in einem Router mit allen drei Zielen. */
function oeffnen(pfad: '/pin/pruefen' | '/anmelden') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Dashboard</p> },
      {
        element: <LoginSchrittRoute schritt="pin" />,
        children: [{ path: '/pin/pruefen', element: <p>PIN-Eingabe</p> }],
      },
      {
        element: <LoginSchrittRoute schritt="name" />,
        children: [{ path: '/anmelden', element: <p>Namensauswahl</p> }],
      },
    ],
    { initialEntries: [pfad] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('LoginSchrittRoute', () => {
  beforeEach(() => sitzungMock.mockReset())

  test('zeigt den Ladespinner, solange der Sitzungszustand unbekannt ist', () => {
    sitzungMock.mockReturnValue(zustand({ laedt: true }))
    oeffnen('/pin/pruefen')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('PIN-Eingabe')).not.toBeInTheDocument()
  })

  test('zeigt ohne Sitzung die PIN-Eingabe', () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/pin/pruefen')
    expect(screen.getByText('PIN-Eingabe')).toBeInTheDocument()
  })

  test('fuehrt ohne Sitzung von der Namensauswahl zurueck zur PIN', () => {
    // Die Namensliste verlangt serverseitig PIN_VERIFIED; ohne Sitzung kaeme 403.
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/anmelden')
    expect(screen.getByText('PIN-Eingabe')).toBeInTheDocument()
  })

  test('fuehrt nach geprueften PIN von der PIN-Eingabe zur Namensauswahl', () => {
    // Das ist zugleich der Uebergang nach einer erfolgreichen PIN-Pruefung.
    sitzungMock.mockReturnValue(zustand({ pinGeprueft: true }))
    oeffnen('/pin/pruefen')
    expect(screen.getByText('Namensauswahl')).toBeInTheDocument()
  })

  test('fuehrt eine angemeldete Person aus beiden Schritten zur Startseite', () => {
    sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
    oeffnen('/pin/pruefen')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  test('nimmt den Navigationszustand bei der Umleitung mit', async () => {
    sitzungMock.mockReturnValue(zustand({ pinGeprueft: true }))
    const router = createMemoryRouter(
      [
        { element: <LoginSchrittRoute schritt="pin" />, children: [{ path: '/pin/pruefen', element: null }] },
        { element: <LoginSchrittRoute schritt="name" />, children: [{ path: '/anmelden', element: null }] },
      ],
      { initialEntries: [{ pathname: '/pin/pruefen', state: { von: '/teams/7' } }] },
    )
    render(<RouterProvider router={router} />)
    // Damit die Anmeldung am Ende dorthin zurueckfuehren kann, woher die Person kam.
    expect(router.state.location.pathname).toBe('/anmelden')
    expect(router.state.location.state).toEqual({ von: '/teams/7' })
  })
})
