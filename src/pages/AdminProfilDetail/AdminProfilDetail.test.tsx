import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { adminHandler, adminWelt, profilModell, type AdminWelt } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminProfilDetail from './AdminProfilDetail'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Zeigt den Pfad der Zielseite. */
function Ziel() {
  return <p data-testid="ziel">{useLocation().pathname}</p>
}

function rendern(pfad: string, welt: AdminWelt = adminWelt(), zustand?: unknown) {
  mockServer.use(...adminHandler(welt))
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[{ pathname: pfad, state: zustand }]}>
        <Routes>
          <Route path="/admin/profile" element={<Ziel />} />
          <Route path="/admin/profile/:spielerId" element={<AdminProfilDetail />} />
          <Route path="/admin/profile/:spielerId/bearbeiten" element={<Ziel />} />
          <Route path="/admin/name/aendern" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

/** Fünf Kategorien, alle von 0 bis 6: Dann gibt es eine gemeinsame Skala. */
const gleicheSkala = [
  { schluessel: 'A', bezeichnung: 'Angriff', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 6 },
  { schluessel: 'B', bezeichnung: 'Block', gewicht: 1, reihenfolge: 2, minWert: 0, maxWert: 6 },
  { schluessel: 'C', bezeichnung: 'Ausdauer', gewicht: 1, reihenfolge: 3, minWert: 0, maxWert: 6 },
]

describe('AdminProfilDetail – Inhalt', () => {
  test('zeigt Name, Spielzahl, Netzdiagramm und je Kategorie Name, Balken und Zahl', async () => {
    rendern('/admin/profile/1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Beispielspieler 01' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-profil-detail-eckdaten')).toHaveTextContent('6 Spiele')
    expect(screen.getByRole('img', { name: /^Netzdiagramm: Angriff 3, Verteidigung 3,/ })).toBeInTheDocument()
    const werte = screen.getByTestId('admin-profil-werte')
    expect(within(werte).getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByTestId('admin-profil-wert-ANGRIFF')).toHaveTextContent('Angriff3')
    expect(screen.getByTestId('admin-profil-wert-TORWART')).toHaveTextContent('Torwart2')
  })

  test('die Balken stehen im Verhältnis zum Bereich der Kategorie', async () => {
    rendern('/admin/profile/1')
    await screen.findByTestId('admin-profil-werte')

    const fuellung = (schluessel: string) =>
      screen.getByTestId(`admin-profil-wert-${schluessel}`).querySelector<HTMLElement>('span > span')?.style.inlineSize
    expect(fuellung('ANGRIFF')).toBe('50%')
    // Torwart: 2 von 3.
    expect(Number.parseFloat(fuellung('TORWART') ?? '')).toBeCloseTo(66.67, 1)
  })

  test('die Skala steht im Kopf, wenn alle Kategorien denselben Bereich haben', async () => {
    const welt = adminWelt({
      skillKategorien: gleicheSkala,
      profile: [profilModell({ spielerId: 1, name: 'Beispielspieler 01', skills: { A: 6, B: 3, C: 0 } })],
    })
    rendern('/admin/profile/1', welt)

    expect(await screen.findByTestId('admin-profil-detail-eckdaten')).toHaveTextContent('Noch keine Spiele · Skalierung 0–6')
  })

  test('eine Kategorie mit eigenem Bereich steht mit ihrer Skala im Kopf', async () => {
    rendern('/admin/profile/1')

    // Vier Kategorien 0 bis 6, Torwart 0 bis 3.
    expect(await screen.findByTestId('admin-profil-detail-eckdaten')).toHaveTextContent('Skalierung 0–6 (Torwart 0–3)')
  })

  test('die Zahl der Spiele hat eine Einzahl und einen Leerzustand', async () => {
    const welt = adminWelt({
      profile: [
        profilModell({ spielerId: 1, name: 'Beispielspieler 01', bilanz: { siege: 1, niederlagen: 0, unentschieden: 0 } }),
        profilModell({ spielerId: 2, name: 'Beispielspieler 02' }),
      ],
    })
    rendern('/admin/profile/1', welt)
    expect(await screen.findByTestId('admin-profil-detail-eckdaten')).toHaveTextContent('1 Spiel')
    expect(screen.getByTestId('admin-profil-detail-eckdaten')).not.toHaveTextContent('1 Spiele')
  })

  test('ohne Spiele steht „Noch keine Spiele“', async () => {
    rendern('/admin/profile/5')

    expect(await screen.findByTestId('admin-profil-detail-eckdaten')).toHaveTextContent('Noch keine Spiele')
  })

  test('eine Lücke in der Karte steht als Strich, im Diagramm als „nicht bewertet“ und als Kennzeichen', async () => {
    rendern('/admin/profile/4')

    expect(await screen.findByTestId('admin-profil-wert-TORWART')).toHaveTextContent('Torwart–')
    expect(screen.getByRole('img')).toHaveAccessibleName(/Torwart nicht bewertet/)
    expect(screen.getByTestId('profil-skills-unvollstaendig-4')).toBeInTheDocument()
  })

  test('ein gesperrtes und ein angemeldetes Profil tragen ihre Marken', async () => {
    rendern('/admin/profile/2')
    expect(await screen.findByTestId('profil-gesperrt-2')).toBeInTheDocument()
  })

  test('ein angemeldetes Profil trägt „online“', async () => {
    rendern('/admin/profile/3')
    expect(await screen.findByTestId('profil-online-3')).toBeInTheDocument()
  })

  test('ein Hinweis aus der Navigation steht oben', async () => {
    rendern('/admin/profile/1', adminWelt(), { hinweis: 'Gespeichert.' })

    expect(await screen.findByTestId('admin-profil-detail-hinweis')).toHaveTextContent('Gespeichert.')
  })

  test('ohne Hinweis steht keiner da', async () => {
    rendern('/admin/profile/1')
    await screen.findByTestId('admin-profil-werte')

    expect(screen.queryByTestId('admin-profil-detail-hinweis')).not.toBeInTheDocument()
  })

  test('„Skills bearbeiten“ führt zum Formular desselben Profils', async () => {
    rendern('/admin/profile/1')

    await userEvent.click(await screen.findByTestId('admin-profil-skills-bearbeiten'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/profile/1/bearbeiten')
  })
})

describe('AdminProfilDetail – Zustände', () => {
  test.each(['abc', '0', '-1', '1.5'])('ungültige Id „%s“: „nicht gefunden“ ohne Abruf', (roh) => {
    const welt = rendern(`/admin/profile/${roh}`)

    expect(screen.getByTestId('nicht-gefunden')).toBeInTheDocument()
    expect(welt.protokoll.profilAbrufe).toHaveLength(0)
    expect(welt.protokoll.skillAbrufe).toHaveLength(0)
  })

  test('beim Laden steht ein Spinner', () => {
    rendern('/admin/profile/1')

    expect(screen.getByText('Profil wird geladen')).toBeInTheDocument()
  })

  test('ein unbekanntes Profil: „Profil nicht gefunden“ mit Link zur Liste', async () => {
    rendern('/admin/profile/777')

    expect(await screen.findByTestId('admin-profil-nicht-gefunden')).toHaveTextContent('Profil nicht gefunden')
    expect(screen.getByTestId('admin-profil-zur-liste')).toHaveAttribute('href', '/admin/profile')
  })

  test('das Adminprofil hat keine Ansicht, aber einen Link zum Anmeldenamen', async () => {
    rendern('/admin/profile/99')

    expect(await screen.findByTestId('admin-profil-admin-hinweis')).toHaveTextContent(
      'Das Adminprofil wird über den Anmeldenamen umbenannt.',
    )
    expect(screen.getByTestId('admin-profil-admin-namenlink')).toHaveAttribute('href', '/admin/name/aendern')
    expect(screen.queryByTestId('admin-profil-werte')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-profil-skills-bearbeiten')).not.toBeInTheDocument()
  })

  test('fallen die Kategorien aus, steht ein Fehlerzustand und es wird nichts geraten', async () => {
    // Die Überschreibung muss nach den Grundhandlern folgen: Der zuletzt angemeldete Handler gewinnt.
    mockServer.use(...adminHandler(adminWelt()))
    mockServer.use(http.get('*/admin/skills/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    render(
      <QueryUmgebung>
        <MemoryRouter initialEntries={['/admin/profile/1']}>
          <Routes>
            <Route path="/admin/profile/:spielerId" element={<AdminProfilDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryUmgebung>,
    )

    expect(await screen.findByTestId('admin-profil-kategorien-fehler', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByTestId('admin-profil-werte')).not.toBeInTheDocument()
  })

  test('fallen die Profile aus, steht ein Fehlerzustand; „Erneut versuchen“ lädt neu', async () => {
    let ausfall = true
    const welt = adminWelt()
    mockServer.use(...adminHandler(welt))
    mockServer.use(
      http.get('*/admin/user/lesen', () => (ausfall ? problem(500, 'INTERNER_FEHLER', 'Interner Fehler.') : undefined)),
    )
    render(
      <QueryUmgebung>
        <MemoryRouter initialEntries={['/admin/profile/1']}>
          <Routes>
            <Route path="/admin/profile/:spielerId" element={<AdminProfilDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryUmgebung>,
    )

    const erneut = await screen.findByTestId('admin-profil-fehler-laden-erneut', {}, { timeout: 4000 })
    ausfall = false
    await userEvent.click(erneut)

    expect(await screen.findByTestId('admin-profil-werte')).toBeInTheDocument()
  })
})
