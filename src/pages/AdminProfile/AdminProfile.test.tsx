import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { adminHandler, adminWelt, profilModell } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminProfile from './AdminProfile'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Zeigt den Pfad der Zielseite. */
function Ziel() {
  return <p data-testid="ziel">{useLocation().pathname}</p>
}

/** Installiert die Admin-Welt; Überschreibungen eines Tests müssen **danach** folgen (der zuletzt angemeldete Handler gewinnt). */
function bereitstellen(welt = adminWelt()) {
  mockServer.use(...adminHandler(welt))
  return welt
}

function rendern(welt = bereitstellen(), zustand?: unknown) {
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[{ pathname: '/admin/profile', state: zustand }]}>
        <Routes>
          <Route path="/admin/profile" element={<AdminProfile />} />
          <Route path="/admin/profile/neu" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

describe('AdminProfile', () => {
  test('zeigt Überschrift, Zahl der Spielerprofile ohne das Adminprofil und die Liste', async () => {
    rendern()

    expect(screen.getByRole('heading', { level: 1, name: 'Spielerprofile' })).toBeInTheDocument()
    expect(await screen.findByTestId('admin-profile-anzahl')).toHaveTextContent('5 Spielerprofile')
    expect(screen.getByTestId('profil-zeile-99')).toHaveTextContent('Beispieladmin')
  })

  test('zeigt beim Laden einen Spinner', () => {
    rendern()

    expect(screen.getByText('Profile werden geladen')).toBeInTheDocument()
  })

  test('benutzt für genau ein Profil die Einzahl', async () => {
    rendern(bereitstellen(adminWelt({ profile: [profilModell({ spielerId: 1, name: 'Beispielspieler 01' })] })))

    expect(await screen.findByTestId('admin-profile-anzahl')).toHaveTextContent('1 Spielerprofil')
    expect(screen.getByTestId('admin-profile-anzahl')).not.toHaveTextContent('Spielerprofile')
  })

  test('Leerzustand, wenn nur das Adminprofil existiert; das Adminprofil bleibt in der Liste', async () => {
    rendern(bereitstellen(adminWelt({ profile: [profilModell({ spielerId: 99, name: 'Beispieladmin', rolle: 'ADMIN' })] })))

    expect(await screen.findByTestId('admin-profile-leer')).toHaveTextContent('Noch keine Spielerprofile')
    expect(screen.getByTestId('admin-profil-anlegen-leer')).toHaveAttribute('href', '/admin/profile/neu')
    expect(screen.getByTestId('profil-zeile-99')).toBeInTheDocument()
    expect(screen.getByTestId('admin-profile-anzahl')).toHaveTextContent('0 Spielerprofile')
  })

  test('Fehler beim Laden: Fehlerzustand mit „Erneut versuchen“, danach die Liste', async () => {
    const welt = bereitstellen()
    let ausfall = true
    mockServer.use(
      http.get('*/admin/user/lesen', () => (ausfall ? problem(500, 'INTERNER_FEHLER', 'Interner Fehler.') : undefined)),
    )
    rendern(welt)

    const erneut = await screen.findByTestId('admin-profile-fehler-erneut', {}, { timeout: 4000 })
    ausfall = false
    await userEvent.click(erneut)

    expect(await screen.findByTestId('profil-liste')).toBeInTheDocument()
  })

  test('kennzeichnet unvollständige Skillkarten, sobald die Kategorien da sind', async () => {
    rendern()

    expect(await screen.findByTestId('profil-skills-unvollstaendig-4')).toBeInTheDocument()
  })

  test('Ausfall der Kategorien: keine Kennzeichnung, aber die Liste bleibt benutzbar', async () => {
    const welt = bereitstellen()
    mockServer.use(http.get('*/admin/skills/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    rendern(welt)

    expect(await screen.findByTestId('profil-liste')).toBeInTheDocument()
    expect(await screen.findByTestId('profil-zeile-4')).toBeInTheDocument()
    expect(screen.queryByTestId('profil-skills-unvollstaendig-4')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-profile-fehler')).not.toBeInTheDocument()
  })

  test('zeigt einen Hinweis aus der Navigation', async () => {
    rendern(bereitstellen(), { hinweis: 'Profil „Beispielspieler 09“ angelegt.' })

    expect(await screen.findByTestId('admin-profile-hinweis')).toHaveTextContent('Profil „Beispielspieler 09“ angelegt.')
  })

  test('„Profil anlegen“ führt zum Formular', async () => {
    rendern()

    await userEvent.click(screen.getByTestId('admin-profil-anlegen'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/profile/neu')
  })

  test('liest ohne Hintergrundkopf', async () => {
    const welt = rendern()

    await screen.findByTestId('profil-liste')

    expect(welt.protokoll.profilAbrufe).toEqual([null])
  })
})
