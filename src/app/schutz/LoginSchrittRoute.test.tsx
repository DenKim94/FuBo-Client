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

  test('fuehrt nach abgeschlossener Anmeldung zur urspruenglich angesteuerten Ansicht', () => {
    sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Dashboard</p> },
        { path: '/teams/7', element: <p>Teams</p> },
        { element: <LoginSchrittRoute schritt="name" />, children: [{ path: '/anmelden', element: null }] },
      ],
      { initialEntries: [{ pathname: '/anmelden', state: { von: '/teams/7' } }] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText('Teams')).toBeInTheDocument()
  })

  test('folgt keinem Ziel ausserhalb der Anwendung', () => {
    sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Dashboard</p> },
        { element: <LoginSchrittRoute schritt="name" />, children: [{ path: '/anmelden', element: null }] },
      ],
      { initialEntries: [{ pathname: '/anmelden', state: { von: '//fremd.example/x' } }] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  test('fuehrt einen angemeldeten Admin ins Admin-Dashboard statt zur Startseite', () => {
    sitzungMock.mockReturnValue(zustand({ angemeldet: true, istAdmin: true }))
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Dashboard</p> },
        { path: '/admin', element: <p>Admin-Dashboard</p> },
        { element: <LoginSchrittRoute schritt="name" />, children: [{ path: '/admin/anmelden', element: null }] },
      ],
      { initialEntries: ['/admin/anmelden'] },
    )
    render(<RouterProvider router={router} />)
    // Nach der Admin-Anmeldung leitet dieser Guard selbst weiter (C4, E1).
    expect(screen.getByText('Admin-Dashboard')).toBeInTheDocument()
  })

  test('hat bei einem gemerkten Ziel dieses vor dem Admin-Dashboard', () => {
    sitzungMock.mockReturnValue(zustand({ angemeldet: true, istAdmin: true }))
    const router = createMemoryRouter(
      [
        { path: '/teams/7', element: <p>Teams</p> },
        { path: '/admin', element: <p>Admin-Dashboard</p> },
        { element: <LoginSchrittRoute schritt="name" />, children: [{ path: '/admin/anmelden', element: null }] },
      ],
      { initialEntries: [{ pathname: '/admin/anmelden', state: { von: '/teams/7' } }] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText('Teams')).toBeInTheDocument()
  })
})

describe('Admin-Anmeldung hinter dem Guard der Stufe PIN_VERIFIED', () => {
  beforeEach(() => sitzungMock.mockReset())

  /** Die Admin-Ansichten sind Geschwister der Namensauswahl in der Gruppe `name` (C4, 4.2). */
  function admin(pfad: string) {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Dashboard</p> },
        { path: '/pin/pruefen', element: <p>PIN-Eingabe</p> },
        {
          element: <LoginSchrittRoute schritt="name" />,
          children: [
            { path: '/anmelden', element: <p>Namensauswahl</p> },
            { path: '/admin/anmelden', element: <p>Admin-Anmeldung</p> },
            { path: '/admin/passwort/vergessen', element: <p>Passwort vergessen</p> },
            { path: '/admin/passwort/neu', element: <p>Passwort neu</p> },
          ],
        },
      ],
      { initialEntries: [pfad] },
    )
    render(<RouterProvider router={router} />)
    return router
  }

  test.each(['/admin/anmelden', '/admin/passwort/vergessen', '/admin/passwort/neu'])(
    'schickt %s ohne Sitzung zur PIN-Eingabe',
    (pfad) => {
      // Der Server antwortete sonst mit 401 SESSION_UNGUELTIG, und die globale
      // Behandlung wuerfe den Admin beim ersten Versuch zur PIN zurueck.
      sitzungMock.mockReturnValue(zustand())
      admin(pfad)
      expect(screen.getByText('PIN-Eingabe')).toBeInTheDocument()
    },
  )

  test.each([
    ['/admin/anmelden', 'Admin-Anmeldung'],
    ['/admin/passwort/vergessen', 'Passwort vergessen'],
    ['/admin/passwort/neu', 'Passwort neu'],
  ])('zeigt %s in PIN_VERIFIED', (pfad, text) => {
    sitzungMock.mockReturnValue(zustand({ pinGeprueft: true }))
    admin(pfad)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  test('schickt einen angemeldeten Spieler von der Admin-Anmeldung zur Startseite', () => {
    // Ein Spieler, der Admin werden will, meldet sich erst ab (sonst 403).
    sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
    admin('/admin/anmelden')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
