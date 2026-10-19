import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { heuteIso } from '@/api/termine/terminZeit'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminTermine from './AdminTermine'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Zeigt den Pfad der Zielseite. */
function Ziel() {
  return <p data-testid="ziel">{useLocation().pathname}</p>
}

/** Ein Datum `YYYY-MM-DD`, `tage` Tage von heute entfernt. */
function tageVonHeute(tage: number): string {
  const jetzt = new Date()
  return heuteIso(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tage))
}

/** Zwei kommende Termine, ein abgeschlossener und ein abgesagter von gestern bzw. vorgestern. */
function beispiel(): TerminModell[] {
  return [
    terminModell({ terminId: 1, datum: tageVonHeute(-2), status: 'ABGESAGT', zusagen: [] }),
    terminModell({ terminId: 2, datum: tageVonHeute(-1), status: 'ABGESCHLOSSEN' }),
    terminModell({ terminId: 3, datum: '2099-01-06', serieId: 7 }),
    terminModell({ terminId: 4, datum: '2099-01-13', ort: null, zusagen: [] }),
  ]
}

function rendern(modelle: TerminModell[] = beispiel(), zustand?: unknown) {
  const admin = adminWelt({ termine: modelle })
  const welt = terminHandlers(admin.termine)
  mockServer.use(...welt.handlers, ...adminHandler(admin))
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[{ pathname: '/admin/termine', state: zustand }]}>
        <Routes>
          <Route path="/admin/termine" element={<AdminTermine />} />
          <Route path="/admin/termine/neu" element={<Ziel />} />
          <Route path="/admin/termine/:terminId" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return { ...welt, admin }
}

describe('AdminTermine', () => {
  test('zeigt Überschrift, die beiden Abschnitte und je ihre Zeilen', async () => {
    rendern()

    expect(screen.getByRole('heading', { level: 1, name: 'Termine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Kommende Termine' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Vergangene Termine (letzte 60 Tage)' })).toBeInTheDocument()

    const kommende = await screen.findByTestId('admin-termine-kommende-liste')
    expect(within(kommende).getByTestId('admin-termin-zeile-3')).toBeInTheDocument()
    expect(within(kommende).getByTestId('admin-termin-zeile-4')).toBeInTheDocument()
    const vergangene = await screen.findByTestId('admin-termine-vergangene-liste')
    expect(within(vergangene).getByTestId('admin-termin-zeile-1')).toBeInTheDocument()
    expect(within(vergangene).getByTestId('admin-termin-zeile-2')).toBeInTheDocument()
  })

  test('Verlauf neueste zuerst, kommende aufsteigend', async () => {
    rendern()

    const vergangene = await screen.findByTestId('admin-termine-vergangene-liste')
    const ids = within(vergangene)
      .getAllByRole('article')
      .map((karte) => karte.getAttribute('data-testid'))
    expect(ids).toEqual(['admin-termin-zeile-2', 'admin-termin-zeile-1'])
  })

  test('„Bearbeiten“ führt zur Verwaltung, bei einem abgesagten Termin heisst es „Öffnen“', async () => {
    rendern()

    expect(await screen.findByTestId('admin-termin-bearbeiten-1')).toHaveTextContent('Öffnen')
    expect(screen.getByTestId('admin-termin-status-1')).toHaveTextContent('Abgesagt')
    expect(screen.getByTestId('admin-termin-bearbeiten-3')).toHaveTextContent('Bearbeiten')

    await userEvent.click(screen.getByTestId('admin-termin-bearbeiten-3'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/termine/3')
  })

  test('kennzeichnet einen Serientermin und zeigt Zusagen nur bei geplanten und abgeschlossenen', async () => {
    rendern()

    expect(await screen.findByTestId('admin-termin-serie-3')).toHaveTextContent('Serie')
    expect(screen.queryByTestId('admin-termin-serie-4')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-termin-zusagen-3')).toHaveTextContent('8 Zusagen')
    expect(screen.queryByTestId('admin-termin-zusagen-1')).not.toBeInTheDocument()
  })

  test('ein heute schon abgeschlossener Termin steht nur im Verlauf, nicht doppelt in den kommenden', async () => {
    rendern([
      terminModell({ terminId: 5, datum: tageVonHeute(0), uhrzeit: '00:00:00', status: 'ABGESCHLOSSEN' }),
      terminModell({ terminId: 3, datum: '2099-01-06' }),
    ])

    const vergangene = await screen.findByTestId('admin-termine-vergangene-liste')
    const kommende = await screen.findByTestId('admin-termine-kommende-liste')
    expect(within(vergangene).getByTestId('admin-termin-zeile-5')).toBeInTheDocument()
    expect(within(kommende).queryByTestId('admin-termin-zeile-5')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('admin-termin-zeile-5')).toHaveLength(1)
  })

  test('liest die Abschnitte wie das Dashboard im Hintergrund (Kopf gesetzt)', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-termine-kommende-liste')

    expect(welt.protokoll.listenabrufe.every((kopf) => kopf === 'true')).toBe(true)
    expect(welt.protokoll.listenabrufe).toHaveLength(2)
  })

  test('Leerzustand der kommenden Termine mit Link zum Anlegen', async () => {
    rendern([])

    expect(await screen.findByTestId('admin-termine-kommende-leer')).toHaveTextContent('Keine kommenden Termine')
    expect(screen.getByTestId('admin-termine-leer-anlegen')).toHaveAttribute('href', '/admin/termine/neu')
    expect(await screen.findByTestId('admin-termine-vergangene-leer')).toHaveTextContent('Keine vergangenen Termine')
  })

  test('beim Laden zeigt jeder Abschnitt seinen Spinner', () => {
    rendern()

    expect(screen.getByText('Termine werden geladen')).toBeInTheDocument()
    expect(screen.getByText('Verlauf wird geladen')).toBeInTheDocument()
  })

  test('der Ausfall der kommenden Termine blockiert den Verlauf nicht; „Erneut versuchen“ lädt neu', async () => {
    const modelle = beispiel()
    const welt = terminHandlers(modelle)
    let ausfall = true
    const heute = tageVonHeute(0)
    mockServer.use(
      http.get('*/termine/lesen', ({ request }) =>
        ausfall && new URL(request.url).searchParams.get('ab') === heute
          ? problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')
          : undefined,
      ),
      ...welt.handlers,
    )
    render(
      <QueryUmgebung>
        <MemoryRouter>
          <AdminTermine />
        </MemoryRouter>
      </QueryUmgebung>,
    )

    const erneut = await screen.findByTestId('admin-termine-kommende-fehler-erneut', {}, { timeout: 4000 })
    expect(await screen.findByTestId('admin-termine-vergangene-liste')).toBeInTheDocument()
    ausfall = false
    await userEvent.click(erneut)

    expect(await screen.findByTestId('admin-termine-kommende-liste')).toBeInTheDocument()
  })

  test('der Ausfall des Verlaufs blockiert die kommenden Termine nicht', async () => {
    const welt = terminHandlers(beispiel())
    const heute = tageVonHeute(0)
    mockServer.use(
      http.get('*/termine/lesen', ({ request }) =>
        new URL(request.url).searchParams.get('ab') !== heute ? problem(500, 'INTERNER_FEHLER', 'Interner Fehler.') : undefined,
      ),
      ...welt.handlers,
    )
    render(
      <QueryUmgebung>
        <MemoryRouter>
          <AdminTermine />
        </MemoryRouter>
      </QueryUmgebung>,
    )

    expect(await screen.findByTestId('admin-termine-kommende-liste')).toBeInTheDocument()
    expect(await screen.findByTestId('admin-termine-vergangene-fehler-erneut', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  test('zeigt einen Hinweis aus der Navigation', async () => {
    rendern(beispiel(), { hinweis: 'Termin entfernt.' })

    expect(await screen.findByTestId('admin-termine-hinweis')).toHaveTextContent('Termin entfernt.')
  })

  test('„Termin anlegen“ führt zum Formular', async () => {
    rendern()

    await userEvent.click(screen.getByTestId('admin-termin-anlegen'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/termine/neu')
  })

  test('„Entfernen“ öffnet die Bestätigung mit Datum und Folgen und sendet erst nach der Bestätigung', async () => {
    const { admin } = rendern([terminModell({ terminId: 4, datum: '2099-01-13', zusagen: [] })])

    await userEvent.click(await screen.findByTestId('admin-termin-entfernen-4'))

    expect(screen.getByTestId('admin-termine-entfernen-dialog')).toHaveTextContent('Dienstag, 13. Januar')
    expect(screen.getByTestId('admin-termine-entfernen-dialog')).toHaveTextContent('Das lässt sich nicht rückgängig machen.')
    expect(admin.protokoll.terminEntfernt).toEqual([])
  })

  test('Abbrechen schliesst die Bestätigung, ohne zu senden', async () => {
    const { admin } = rendern([terminModell({ terminId: 4, datum: '2099-01-13', zusagen: [] })])

    await userEvent.click(await screen.findByTestId('admin-termin-entfernen-4'))
    await userEvent.click(screen.getByTestId('admin-termine-entfernen-dialog-abbrechen'))

    expect(screen.getByTestId('admin-termine-entfernen-dialog')).not.toBeVisible()
    expect(admin.protokoll.terminEntfernt).toEqual([])
    expect(screen.getByTestId('admin-termin-zeile-4')).toBeInTheDocument()
  })

  test('Erfolg: Termin ist weg, „Termin entfernt.“ steht oben, der Fokus liegt auf der Überschrift', async () => {
    const { admin } = rendern([
      terminModell({ terminId: 4, datum: '2099-01-13', zusagen: [] }),
      terminModell({ terminId: 3, datum: '2099-01-06' }),
    ])

    await userEvent.click(await screen.findByTestId('admin-termin-entfernen-4'))
    await userEvent.click(screen.getByTestId('admin-termine-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-termine-entfernt')).toHaveTextContent('Termin entfernt.')
    expect(admin.protokoll.terminEntfernt).toEqual([{ terminId: 4 }])
    await waitFor(() => {
      expect(screen.queryByTestId('admin-termin-zeile-4')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { level: 1, name: 'Termine' })).toHaveFocus()
  })

  test('Fehler des Servers bleibt im Dialog sichtbar, der Dialog bleibt offen', async () => {
    rendern([terminModell({ terminId: 4, datum: '2099-01-13', zusagen: [] })])
    mockServer.use(http.post('*/admin/termin/entfernen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))

    await userEvent.click(await screen.findByTestId('admin-termin-entfernen-4'))
    await userEvent.click(screen.getByTestId('admin-termine-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-termine-entfernen-dialog-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('admin-termine-entfernen-dialog')).toBeVisible()
    expect(screen.queryByTestId('admin-termine-entfernt')).not.toBeInTheDocument()
  })

  test('TERMIN_IN_VERWENDUNG schliesst den Dialog, nennt den Grund und verlinkt die Verwaltung', async () => {
    rendern([terminModell({ terminId: 3, datum: '2099-01-06' })])

    await userEvent.click(await screen.findByTestId('admin-termin-entfernen-3'))
    await userEvent.click(screen.getByTestId('admin-termine-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-termine-in-verwendung')).toHaveTextContent(
      'Am Termin hängen Rückmeldungen oder Teams; er lässt sich nicht entfernen.',
    )
    expect(screen.getByTestId('admin-termine-entfernen-dialog')).not.toBeVisible()
    expect(screen.getByTestId('admin-termine-in-verwendung-link')).toHaveAttribute('href', '/admin/termine/3')
    expect(screen.getByTestId('admin-termin-zeile-3')).toBeInTheDocument()
  })

  test('404: Hinweis „Der Termin existiert nicht mehr.“, Dialog zu', async () => {
    const { admin } = rendern([terminModell({ terminId: 4, datum: '2099-01-13', zusagen: [] })])
    await screen.findByTestId('admin-termin-entfernen-4')
    admin.termine.splice(0, admin.termine.length)

    await userEvent.click(screen.getByTestId('admin-termin-entfernen-4'))
    await userEvent.click(screen.getByTestId('admin-termine-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-termine-verschwunden')).toHaveTextContent(
      'Der Termin existiert nicht mehr.',
    )
    expect(screen.getByTestId('admin-termine-entfernen-dialog')).not.toBeVisible()
  })

  test('ein abgeschlossener Termin bietet kein „Entfernen“ an', async () => {
    rendern()

    expect(await screen.findByTestId('admin-termin-zeile-2')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-entfernen-2')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-termin-entfernen-1')).toBeInTheDocument()
  })
})
