import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { heuteIso, VERLAUF_TAGE, verlaufAb } from '@/api/termine/terminZeit'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import VerlaufSeite from './VerlaufSeite'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Das Datum vor `n` Tagen. */
function vorTagen(n: number): string {
  return heuteIso(new Date(Date.now() - n * 86_400_000))
}

function rendern(...modelle: TerminModell[]) {
  const welt = terminHandlers(modelle)
  mockServer.use(...welt.handlers)
  const router = createMemoryRouter(
    [
      { path: '/verlauf', element: <VerlaufSeite /> },
      { path: '*', element: <p>Sonst</p> },
    ],
    { initialEntries: ['/verlauf'] },
  )
  render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
  return { welt, router }
}

describe('VerlaufSeite', () => {
  test('zeigt vergangene Termine, neueste zuerst', async () => {
    rendern(
      terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: vorTagen(21) }),
      terminModell({ terminId: 2, status: 'ABGESAGT', datum: vorTagen(14), zusagen: [] }),
      terminModell({ terminId: 3, status: 'ABGESCHLOSSEN', datum: vorTagen(7) }),
    )
    await screen.findByTestId('verlauf-liste')
    const zeilen = screen.getAllByRole('listitem')

    expect(zeilen).toHaveLength(3)
    expect(zeilen[0]).toContainElement(screen.getByTestId('verlauf-link-3'))
    expect(zeilen[1]).toContainElement(screen.getByTestId('verlauf-zeile-2'))
    expect(zeilen[2]).toContainElement(screen.getByTestId('verlauf-link-1'))
  })

  test('fragt mit dem Stichtag heute minus VERLAUF_TAGE und dem Hintergrundkopf ab', async () => {
    const { welt } = rendern(terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: vorTagen(3) }))
    await screen.findByTestId('verlauf-liste')

    expect(welt.protokoll.stichtage).toEqual([verlaufAb(new Date())])
    expect(welt.protokoll.listenabrufe).toEqual(['true'])
  })

  test('nennt im Satz unter der Liste die Zahl der Tage aus der Konstante', async () => {
    rendern(terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: vorTagen(3) }))
    expect(await screen.findByTestId('verlauf-hinweis')).toHaveTextContent(
      `Angezeigt werden die Termine der letzten ${String(VERLAUF_TAGE)} Tage.`,
    )
  })

  test('laesst kuenftige und aeltere Termine weg', async () => {
    rendern(
      terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: vorTagen(VERLAUF_TAGE + 10) }),
      terminModell({ terminId: 2, status: 'ABGESCHLOSSEN', datum: vorTagen(5) }),
      terminModell({ terminId: 3, status: 'ABGESAGT', datum: '2099-01-06', zusagen: [] }),
      terminModell({ terminId: 4, datum: '2099-01-13' }),
    )
    await screen.findByTestId('verlauf-liste')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByTestId('verlauf-link-2')).toBeInTheDocument()
  })

  test('zeigt ohne vergangene Termine den Leerzustand und keinen Satz', async () => {
    rendern(terminModell({ terminId: 4, datum: '2099-01-13' }))
    expect(await screen.findByTestId('verlauf-leer')).toHaveTextContent('Noch keine vergangenen Termine')
    expect(screen.queryByTestId('verlauf-liste')).not.toBeInTheDocument()
    expect(screen.queryByTestId('verlauf-hinweis')).not.toBeInTheDocument()
  })

  test('zeigt bei einem Serverfehler den Fehlerzustand und laedt auf Wunsch neu', async () => {
    mockServer.use(http.get('*/termine/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    const router = createMemoryRouter([{ path: '/verlauf', element: <VerlaufSeite /> }], {
      initialEntries: ['/verlauf'],
    })
    render(<RouterProvider router={router} />, { wrapper: QueryUmgebung })
    expect(await screen.findByTestId('verlauf-fehler-zustand', undefined, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.queryByTestId('verlauf-leer')).not.toBeInTheDocument()

    const welt = terminHandlers([terminModell({ terminId: 1, status: 'ABGESCHLOSSEN', datum: vorTagen(3) })])
    mockServer.use(...welt.handlers)
    await userEvent.click(screen.getByRole('button', { name: /erneut/i }))
    expect(await screen.findByTestId('verlauf-liste')).toBeInTheDocument()
  }, 20000)

  test('fuehrt ueber den Link zur Ergebnisseite des Termins', async () => {
    const { router } = rendern(terminModell({ terminId: 7, status: 'ABGESCHLOSSEN', datum: vorTagen(3) }))
    await userEvent.click(await screen.findByTestId('verlauf-link-7'))
    expect(router.state.location.pathname).toBe('/ergebnisse/7')
  })

  test('hat eine Ueberschrift der Ebene 1', async () => {
    rendern(terminModell({ terminId: 4, datum: '2099-01-13' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Verlauf' })).toBeInTheDocument()
  })
})
