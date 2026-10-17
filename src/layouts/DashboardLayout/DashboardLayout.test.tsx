import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { beispielAdminSitzung } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import DashboardLayout from './DashboardLayout'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

function rendern() {
  const router = createMemoryRouter(
    [
      {
        element: <DashboardLayout />,
        children: [{ path: '/', element: <p>Bereich</p> }],
      },
      { path: '/admin', element: <p>Admin-Start</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
  return router
}

describe('DashboardLayout', () => {
  test('zeigt Tab-Leiste und Bereich', async () => {
    rendern()
    expect(await screen.findByText('Bereich')).toBeInTheDocument()
    expect(screen.getByTestId('tab-leiste')).toBeInTheDocument()
  })

  test('leitet den Admin nach /admin um, ohne Leiste', async () => {
    mockServer.use(
      http.get('*/auth/session/lesen', () => HttpResponse.json(beispielAdminSitzung)),
    )
    const router = rendern()
    expect(await screen.findByText('Admin-Start')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
    expect(screen.queryByTestId('tab-leiste')).not.toBeInTheDocument()
  })
})
