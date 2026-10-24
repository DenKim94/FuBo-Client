import { render, screen, within } from '@testing-library/react'
import { http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminDashboard from './AdminDashboard'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Rendert das Dashboard mit der Terminwelt; `zustand` ist der Navigationszustand. */
function rendern(modelle: ReturnType<typeof terminModell>[], zustand?: unknown) {
  const welt = terminHandlers(modelle)
  mockServer.use(...welt.handlers)
  render(
    <MemoryRouter initialEntries={[{ pathname: '/admin', state: zustand }]}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryUmgebung },
  )
  return welt
}

describe('AdminDashboard', () => {
  test('zeigt die Verwaltungsliste mit allen Zielen in drei Gruppen', async () => {
    rendern([terminModell({ terminId: 1, datum: '2099-01-06' })])

    for (const id of [
      'admin-link-profile',
      'admin-link-termine',
      'admin-link-gaeste',
      'admin-link-konfiguration',
      'admin-link-teams',
      'admin-link-pin',
      'admin-link-name',
      'admin-link-passwort',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
    expect(screen.getByTestId('admin-link-pin')).toHaveAttribute('href', '/admin/pin')
    expect(screen.getByTestId('admin-link-name')).toHaveAttribute('href', '/admin/name/aendern')
    expect(screen.getByTestId('admin-link-passwort')).toHaveAttribute('href', '/admin/passwort/aendern')
    expect(screen.getByRole('heading', { level: 1, name: 'Administration' })).toBeInTheDocument()
    await screen.findByTestId('admin-termin-verwalten-link')
  })

  test('Texte und Symbole seit 24.10.2026: „Teams manuell einteilen“ mit „Team-Generator“, „Gäste“, Ausweis beim Anmeldenamen', async () => {
    rendern([terminModell({ terminId: 1, datum: '2099-01-06' })])

    const gruppen = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(gruppen).toEqual(expect.arrayContaining(['Verwaltung', 'Teams manuell einteilen', 'Zugang']))
    expect(gruppen).not.toContain('Werkzeuge')
    const teams = screen.getByTestId('admin-link-teams')
    expect(teams).toHaveTextContent('Team-Generator')
    expect(teams).toHaveTextContent('Erstelle Teams für selbst ausgewählte Teilnehmer')
    expect(within(teams).getByTestId('icon-football_icon_dark')).toBeInTheDocument()
    expect(screen.getByTestId('admin-link-gaeste')).toHaveTextContent('Gäste')
    expect(within(screen.getByTestId('admin-link-name')).getByTestId('icon-id_card_icon')).toBeInTheDocument()
    expect(within(screen.getByTestId('admin-link-name')).queryByTestId('icon-mail_icon_dark')).not.toBeInTheDocument()
    await screen.findByTestId('admin-termin-verwalten-link')
  })

  test('zeigt den nächsten Termin nur lesend mit dem Link „Termin verwalten“', async () => {
    rendern([terminModell({ terminId: 7, datum: '2099-01-06' }), terminModell({ terminId: 8, datum: '2099-01-13' })])

    const link = await screen.findByTestId('admin-termin-verwalten-link')
    expect(link).toHaveAttribute('href', '/admin/termine/7')
    // E2: Der Admin kann weder zu- noch absagen, und es gibt kein „Anmeldung ausstehend“.
    expect(await screen.findByTestId('teilnehmerliste')).toBeInTheDocument()
    expect(screen.queryByTestId('rueckmeldung-zusagen')).not.toBeInTheDocument()
    expect(screen.queryByText(/Anmeldung ausstehend/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('rueckmeldung-absagen')).not.toBeInTheDocument()
  })

  test('ohne Termin: Leerzustand mit Link zum Anlegen, die Verwaltung bleibt erreichbar', async () => {
    rendern([])

    expect(await screen.findByTestId('admin-dashboard-leer')).toBeInTheDocument()
    expect(screen.getByTestId('admin-termin-anlegen-link')).toHaveAttribute('href', '/admin/termine/neu')
    expect(screen.getByTestId('admin-link-profile')).toBeInTheDocument()
  })

  test('Fehler beim Laden der Termine blockiert die Verwaltungsliste nicht', async () => {
    mockServer.use(http.get('*/termine/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AdminDashboard />
      </MemoryRouter>,
      { wrapper: QueryUmgebung },
    )

    expect(await screen.findByTestId('admin-dashboard-fehler', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByTestId('admin-link-profile')).toBeInTheDocument()
    expect(screen.getByTestId('admin-link-pin')).toBeInTheDocument()
  })

  test('zeigt einen Hinweis aus der Navigation', async () => {
    rendern([], { hinweis: 'Anmeldename geändert. Er gilt ab der nächsten Anmeldung.' })

    expect(await screen.findByTestId('admin-dashboard-hinweis')).toHaveTextContent('Anmeldename geändert.')
  })

  test('ohne Hinweis steht keine Meldung da', async () => {
    rendern([])

    await screen.findByTestId('admin-dashboard-leer')
    expect(screen.queryByTestId('admin-dashboard-hinweis')).not.toBeInTheDocument()
  })

  test('Abrufe ohne Wiederholung im Hintergrund: ein Listenabruf, kein Aktualisieren-Kopf nötig', async () => {
    const welt = rendern([terminModell({ terminId: 1, datum: '2099-01-06' })])

    await screen.findByTestId('admin-termin-verwalten-link')
    expect(welt.protokoll.listenabrufe).toHaveLength(1)
  })
})

