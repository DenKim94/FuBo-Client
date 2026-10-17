import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { HttpResponse, http } from 'msw'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import Dashboard from './Dashboard'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

function rendern(...modelle: ReturnType<typeof terminModell>[]) {
  mockServer.use(...terminHandlers(modelle).handlers)
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
    { wrapper: QueryUmgebung },
  )
}

const abgesagt = (id: number, datum: string) =>
  terminModell({ terminId: id, datum, status: 'ABGESAGT', zusagen: [] })

describe('Dashboard', () => {
  test('zeigt den ersten geplanten Termin mit eingeklappter Liste und die weiteren darunter', async () => {
    rendern(
      terminModell({ terminId: 1, datum: '2099-01-06' }),
      terminModell({ terminId: 2, datum: '2099-01-13' }),
      terminModell({ terminId: 3, datum: '2099-01-20' }),
    )
    // Die Ansicht steht schon im Ladezustand; die Liste erst mit den Daten des Termins.
    expect(await screen.findByTestId('teilnehmerliste')).not.toHaveAttribute('open')
    // Der erste Termin steht oben und nicht noch einmal in der Liste.
    expect(screen.queryByTestId('termin-link-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('termin-link-2')).toBeInTheDocument()
    expect(screen.getByTestId('termin-link-3')).toBeInTheDocument()
  })

  test('setzt die Aktionsleiste hinter die weiteren Termine', async () => {
    rendern(terminModell({ terminId: 1 }), terminModell({ terminId: 2, datum: '2099-01-20' }))
    const leiste = await screen.findByTestId('aktionsleiste')
    await screen.findByTestId('weitere-termine')
    expect(screen.getByTestId('termin-ansicht').lastElementChild).toBe(leiste)
  })

  test('weist auf einen abgesagten Termin davor hin und fuehrt ihn nicht in der Liste', async () => {
    rendern(abgesagt(1, '2099-01-06'), terminModell({ terminId: 2, datum: '2099-01-13' }))
    expect(await screen.findByTestId('dashboard-abgesagt-1')).toHaveTextContent('fällt aus')
    expect(screen.queryByTestId('termin-link-1')).not.toBeInTheDocument()
  })

  test('zeigt hoechstens zwei Hinweise und nennt weitere gesammelt', async () => {
    rendern(
      abgesagt(1, '2099-01-06'),
      abgesagt(2, '2099-01-07'),
      abgesagt(3, '2099-01-08'),
      terminModell({ terminId: 4, datum: '2099-01-13' }),
    )
    await screen.findByTestId('teilnehmerliste')
    expect(screen.getByTestId('dashboard-abgesagt-1')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-abgesagt-2')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-abgesagt-3')).not.toBeInTheDocument()
    expect(screen.getByTestId('dashboard-abgesagt-mehr')).toHaveTextContent('… und weitere abgesagte Termine')
  })

  test('zeigt abgesagte Termine nach dem naechsten in der Liste mit „Abgesagt“', async () => {
    rendern(terminModell({ terminId: 1 }), abgesagt(2, '2099-01-20'))
    expect(await screen.findByTestId('termin-link-2')).toHaveTextContent('Abgesagt')
    expect(screen.queryByTestId('dashboard-abgesagt-2')).not.toBeInTheDocument()
  })

  test('zeigt ohne geplanten Termin den Leerzustand', async () => {
    rendern()
    expect(await screen.findByTestId('dashboard-leer')).toHaveTextContent('Kein Termin geplant')
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('zeigt bei nur abgesagten Terminen Hinweise und den Leerzustand', async () => {
    rendern(abgesagt(1, '2099-01-06'))
    expect(await screen.findByTestId('dashboard-leer')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-abgesagt-1')).toBeInTheDocument()
  })

  test('zeigt bei einem Serverfehler ohne Daten einen Fehlerzustand', async () => {
    mockServer.use(http.get('*/termine/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )
    expect(await screen.findByTestId('dashboard-fehler', undefined, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-leer')).not.toBeInTheDocument()
  }, 15000)

  test('unterscheidet Fehler von leerer Liste', async () => {
    mockServer.use(http.get('*/termine/lesen', () => HttpResponse.json([])))
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )
    expect(await screen.findByTestId('dashboard-leer')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-fehler')).not.toBeInTheDocument()
  })
})
