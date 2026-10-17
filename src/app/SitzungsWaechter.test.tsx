import { act, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import SitzungsWaechter from '@/app/SitzungsWaechter'
import { queryClient, sitzungsendeAusloesen, sitzungsendeBehandeln } from '@/app/queryClient'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('SitzungsWaechter', () => {
  test('fuehrt bei einem Sitzungsende zur PIN-Eingabe, ohne die Seite neu zu laden', async () => {
    const router = createMemoryRouter(
      [
        {
          element: (
            <>
              <SitzungsWaechter />
              <p>Geschuetzte Ansicht</p>
            </>
          ),
          children: [{ path: '/teams/1', element: null }],
        },
        { path: '/pin/pruefen', element: <p>PIN-Eingabe</p> },
      ],
      { initialEntries: ['/teams/1'] },
    )
    render(<RouterProvider router={router} />)

    // Eine beliebige Abfrage laeuft in einen abgelaufenen Sitzungszustand.
    // In `act`, weil die Umleitung als Folge des Fehlers gerendert wird.
    await act(async () => {
      await queryClient
        .fetchQuery({
          queryKey: ['beliebig'],
          queryFn: () => {
            throw new ApiFehler(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.')
          },
        })
        .catch(() => {})
    })

    expect(screen.getByText('PIN-Eingabe')).toBeInTheDocument()
  })

  test('gibt einen Hinweis als Navigationszustand an die PIN-Eingabe weiter', () => {
    const router = createMemoryRouter(
      [
        {
          element: (
            <>
              <SitzungsWaechter />
              <p>Geschuetzte Ansicht</p>
            </>
          ),
          children: [{ path: '/admin/passwort/aendern', element: null }],
        },
        { path: '/pin/pruefen', element: <p>PIN-Eingabe</p> },
      ],
      { initialEntries: ['/admin/passwort/aendern'] },
    )
    render(<RouterProvider router={router} />)

    act(() => sitzungsendeAusloesen('Passwort geändert. Bitte melde dich mit dem neuen Passwort an.'))

    expect(router.state.location.pathname).toBe('/pin/pruefen')
    expect(router.state.location.state).toEqual({
      hinweis: 'Passwort geändert. Bitte melde dich mit dem neuen Passwort an.',
    })
  })

  test('geht ohne Hinweis ohne Navigationszustand zur PIN-Eingabe', () => {
    const router = createMemoryRouter(
      [
        { element: <SitzungsWaechter />, children: [{ path: '/teams/1', element: null }] },
        { path: '/pin/pruefen', element: <p>PIN-Eingabe</p> },
      ],
      { initialEntries: ['/teams/1'] },
    )
    render(<RouterProvider router={router} />)

    act(() => sitzungsendeAusloesen())

    expect(router.state.location.pathname).toBe('/pin/pruefen')
    expect(router.state.location.state).toBeNull()
  })
})
