import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import type { SitzungZustand } from '@/hooks/useSitzung'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { beispielAdminSitzung } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import { routen } from './routen'
import routenQuelle from './routen.tsx?raw'

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

// Die Admin-Seiten werden nachgeladen. Der erste Import übersetzt in Vitest den ganzen Admin-Bereich und dauert
// länger als die Wartezeit von `findBy` (1 s); vorab geladen, misst jeder Test nur noch das Routing.
beforeAll(async () => {
  await import('./adminSeiten')
}, 30_000)

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

  test('/admin/profile/1 zeigt die Profilansicht, nicht das Formular', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/profile/1')

    expect(await screen.findByTestId('admin-profil-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-profil-formular')).not.toBeInTheDocument()
  })

  test('/admin/profile/1/bearbeiten zeigt das Formular mit dem Profil', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/profile/1/bearbeiten')

    expect(await screen.findByTestId('admin-profil-formular')).toBeInTheDocument()
    expect(await screen.findByTestId('skill-ANGRIFF')).toBeInTheDocument()
  })

  test.each(['abc', '0', '-1', '1.5'])('ungültige Id „%s“ im Formular führt zu „nicht gefunden“ ohne Abruf', async (id) => {
    sitzungMock.mockReturnValue(zustand())
    const { welt } = oeffnen(`/admin/profile/${id}/bearbeiten`)

    expect(await screen.findByTestId('nicht-gefunden')).toBeInTheDocument()
    expect(welt.protokoll.profilAbrufe).toHaveLength(0)
  })

  test('„Zurück“ im Formular führt zur Profilansicht desselben Profils', async () => {
    sitzungMock.mockReturnValue(zustand())
    const { router } = oeffnen('/admin/profile/1/bearbeiten')
    await screen.findByTestId('admin-profil-formular')

    fireEvent.click(await screen.findByTestId('layout-zurueck'))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/admin/profile/1'))
  })

  test('„Zurück“ in der Profilansicht führt zur Liste', async () => {
    sitzungMock.mockReturnValue(zustand())
    const { router } = oeffnen('/admin/profile/1')
    await screen.findByTestId('admin-profil-detail')

    fireEvent.click(await screen.findByTestId('layout-zurueck'))

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/admin/profile'))
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

describe('Routen der Konfiguration, der Gastplätze und der manuellen Teams', () => {
  test('/admin/konfiguration zeigt das Formular', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/konfiguration')

    expect(await screen.findByTestId('admin-konfiguration')).toBeInTheDocument()
  })

  test('/admin/gaeste zeigt die Gastplätze', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/gaeste')

    expect(await screen.findByTestId('admin-gaeste')).toBeInTheDocument()
  })

  test('/admin/teams zeigt die manuelle Generierung', async () => {
    sitzungMock.mockReturnValue(zustand())
    oeffnen('/admin/teams')

    expect(await screen.findByTestId('admin-teams')).toBeInTheDocument()
  })

  test.each(['/admin/konfiguration', '/admin/gaeste', '/admin/teams'])('eine Nicht-Admin-Sitzung wird von %s auf die Startseite geleitet', async (pfad) => {
    sitzungMock.mockReturnValue(zustand({ istAdmin: false }))
    const { router } = oeffnen(pfad)

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(screen.queryByTestId('admin-konfiguration')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-gaeste')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-teams')).not.toBeInTheDocument()
  })
})

describe('Nachladen des Admin-Bereichs', () => {
  test('der Routenbaum importiert keine Admin-Seite fest (sonst landete sie wieder im Hauptpaket)', () => {
    const feste = routenQuelle.match(/^import .* from '@\/pages\/(Admin|Passwort)\w*\/.*$/gm) ?? []
    expect(feste).toEqual([])
  })

  test('eine Admin-Route lädt ihre Seite nach und zeigt sie', async () => {
    sitzungMock.mockReturnValue(zustand())
    const { router } = oeffnen('/admin/profile/neu')

    expect(await screen.findByTestId('admin-profil-formular')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/profile/neu')
  })
})
