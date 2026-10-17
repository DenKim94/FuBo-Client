import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import TerminDetail from './TerminDetail'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

function rendern(pfad: string) {
  const welt = terminHandlers([terminModell({ terminId: 102 })])
  mockServer.use(...welt.handlers)
  const router = createMemoryRouter(
    [{ path: 'termine/:terminId', element: <TerminDetail /> }, { path: '*', element: <p>Sonst</p> }],
    { initialEntries: [pfad] },
  )
  render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
  return welt
}

describe('TerminDetail', () => {
  test('zeigt den Termin mit offener Liste und Verweisen', async () => {
    rendern('/termine/102')
    expect(await screen.findByTestId('termin-detail')).toBeInTheDocument()
    expect(await screen.findByTestId('teilnehmerliste')).toHaveAttribute('open')
    expect(screen.getByTestId('termin-teams-link')).toBeInTheDocument()
    expect(screen.getByTestId('aktionsleiste')).toBeInTheDocument()
  })

  test.each(['abc', '0', '-1', '1.5', '12abc'])('zeigt bei der ungueltigen Adresse %s „nicht gefunden“ ohne Abruf', async (id) => {
    const welt = rendern(`/termine/${id}`)
    expect(await screen.findByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
    expect(welt.protokoll.detailabrufe).toHaveLength(0)
  })

  test('zeigt bei einem unbekannten Termin den Leerzustand der Ansicht', async () => {
    rendern('/termine/999')
    expect(await screen.findByTestId('termin-nicht-gefunden')).toBeInTheDocument()
  })
})
