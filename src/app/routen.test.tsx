import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import type { SitzungZustand } from '@/hooks/useSitzung'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { beispielAdminSitzung } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import { routen } from './routen'

const sitzungMock = vi.fn<() => SitzungZustand>()
vi.mock('@/hooks/useSitzung', () => ({ useSitzung: () => sitzungMock() }))

// Der Ablauf-Dialog braucht einen Server; hier zaehlt nur der Routenbaum.
vi.mock('@/components/SitzungAblaufDialog/SitzungAblaufDialog', () => ({
  default: () => null,
}))

function zustand(teil: Partial<SitzungZustand> = {}): SitzungZustand {
  return {
    laedt: false,
    sitzung: beispielAdminSitzung,
    angemeldet: true,
    pinGeprueft: true,
    istAdmin: true,
    istGast: false,
    ...teil,
  }
}

function oeffnen(pfad: string) {
  const welt = adminWelt({
    termine: [terminModell({ terminId: 101, datum: '2099-01-06', uhrzeit: '19:00:00', zusagen: [] })],
  })
  mockServer.use(...terminHandlers(welt.termine).handlers, ...adminHandler(welt))
  const router = createMemoryRouter(routen.routes, { initialEntries: [pfad] })
  render(
    <QueryUmgebung>
      <RouterProvider router={router} />
    </QueryUmgebung>,
  )
  return { welt, router }
}

beforeEach(() => sitzungMock.mockReset())
afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('Routen der Profilverwaltung', () => {
  test('/admin/profile/neu zeigt das Formular, nicht „nicht gefunden“', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/profile/neu')

    expect(await screen.findByTestId('admin-profil-formular')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-profil-nicht-gefunden')).not.toBeInTheDocument()
  })

  test('/admin/profile zeigt die Liste', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/profile')

    expect(await screen.findByTestId('admin-profile-anzahl')).toBeInTheDocument()
  })

  test.each(['abc', '0', '-1', '1.5'])('ungültige Id „%s“ führt zu „nicht gefunden“ ohne Abruf', async (id) => {
    sitzungMock.mockReturnValue(zustand())
    const { welt } = oeffnen(`/admin/profile/${id}`)

    expect(await screen.findByTestId('nicht-gefunden')).toBeInTheDocument()
    expect(welt.protokoll.profilAbrufe).toHaveLength(0)
    expect(welt.protokoll.skillAbrufe).toHaveLength(0)
  })

  test('eine Nicht-Admin-Sitzung wird auf die Startseite geleitet', async () => {
    sitzungMock.mockReturnValue(zustand({ istAdmin: false }))
    const { router, welt } = oeffnen('/admin/profile/neu')

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.queryByTestId('admin-profil-formular')).not.toBeInTheDocument()
    expect(welt.protokoll.profilAbrufe).toHaveLength(0)
    expect(welt.protokoll.skillAbrufe).toHaveLength(0)
  })

  test('ohne Sitzung führt der Weg zur PIN-Eingabe', async () => {
    sitzungMock.mockReturnValue(zustand({ sitzung: null, angemeldet: false, pinGeprueft: false, istAdmin: false }))
    const { router } = oeffnen('/admin/profile')

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/pin/pruefen'))
    expect(screen.queryByTestId('admin-profile-anzahl')).not.toBeInTheDocument()
  })
})


describe('Routen der Terminverwaltung', () => {
  test('/admin/termine zeigt die Liste', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/termine')

    expect(await screen.findByTestId('admin-termin-anlegen')).toBeInTheDocument()
  })

  test('/admin/termine/neu zeigt das Formular, nicht die Verwaltung eines Termins „neu“', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/termine/neu')

    expect(await screen.findByTestId('admin-termin-neu-absenden')).toBeInTheDocument()
    expect(screen.queryByTestId('nicht-gefunden')).not.toBeInTheDocument()
  })

  test('/admin/termine/101 zeigt die Verwaltung', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/termine/101')

    expect(await screen.findByTestId('admin-termin-verwaltung')).toBeInTheDocument()
  })

  test.each(['abc', '0', '-1', '1.5'])('ungültige Termin-Id „%s“ führt zu „nicht gefunden“', async (id) => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen(`/admin/termine/${id}`)

    expect(await screen.findByTestId('nicht-gefunden')).toBeInTheDocument()
  })

  test('eine Nicht-Admin-Sitzung wird von der Terminverwaltung auf die Startseite geleitet', async () => {
    sitzungMock.mockReturnValue(zustand({ istAdmin: false }))
    const { router } = oeffnen('/admin/termine/neu')

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.queryByTestId('admin-termin-neu-absenden')).not.toBeInTheDocument()
  })
})
