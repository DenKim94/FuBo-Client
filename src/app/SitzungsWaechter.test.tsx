import { act, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/fehler'
import SitzungsWaechter from '@/app/SitzungsWaechter'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('SitzungsWaechter', () => {
  test('fuehrt bei einem 401 zurueck zur Anmeldung, ohne die Seite neu zu laden', async () => {
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
        { path: '/anmelden', element: <p>Anmeldung</p> },
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

    expect(screen.getByText('Anmeldung')).toBeInTheDocument()
  })
})
