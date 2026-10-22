import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { adminHandler, adminWelt, beispielKonfiguration } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminTerminDetail from './AdminTerminDetail'

afterEach(() => {
  queryClient.clear()
})

type Konfig = Parameters<typeof beispielKonfiguration>[0]

/** Hallenmodus an und Adresse da, wenn nichts anderes gesagt ist. */
function rendern(modell: Partial<TerminModell> = {}, konfiguration: Konfig = {}) {
  const welt = adminWelt({
    termine: [terminModell({ terminId: 101, datum: '2099-01-13', ...modell })],
    konfiguration: beispielKonfiguration({ hallenModusAktiv: true, halleEmail: 'halle@beispiel.example', ...konfiguration }),
  })
  const lesen = terminHandlers(welt.termine)
  mockServer.use(...adminHandler(welt), ...lesen.handlers)
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={['/admin/termine/101']}>
        <Routes>
          <Route path="/admin/termine/:terminId" element={<AdminTerminDetail />} />
          <Route path="/admin/konfiguration" element={<p data-testid="seite-konfiguration">Konfiguration</p>} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

/** Wartet, bis die Terminverwaltung steht (Termin und Konfiguration sind dann gelesen). */
async function bereit() {
  await screen.findByTestId('admin-termin-verwaltung')
  await waitFor(() => expect(screen.queryByTestId('admin-halle-abschnitt') ?? screen.getByTestId('admin-termin-verwaltung')).toBeTruthy())
}

async function keinAbschnitt() {
  await bereit()
  // Die Konfiguration ist ein eigener Abruf; kurz warten, damit „kein Abschnitt“ nicht nur „noch nicht da“ heißt.
  await new Promise((r) => setTimeout(r, 120))
  expect(screen.queryByTestId('admin-halle-abschnitt')).not.toBeInTheDocument()
}

/** Der Dialog ist ein `<dialog>`, das auch geschlossen im Baum steht; „zu“ heißt: nicht sichtbar. */
function dialogZu() {
  const dialog = screen.queryByTestId('admin-halle-dialog')
  if (dialog) expect(dialog).not.toBeVisible()
}

describe('TerminHalle – Zustände (C8 10.1)', () => {
  test('Hallenmodus aus: kein Abschnitt', async () => {
    rendern({}, { hallenModusAktiv: false })
    await keinAbschnitt()
  })

  test('geplant, Modus an, Adresse da, Frist offen: „Absage möglich bis …“ und eine nutzbare Aktion', async () => {
    rendern()

    const abschnitt = await screen.findByTestId('admin-halle-abschnitt')
    expect(within(abschnitt).getByRole('heading', { level: 2, name: 'Hallenabsage' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-halle-moeglich')).toHaveTextContent('Absage möglich bis 13.01., 19:00 Uhr.')
    const knopf = screen.getByTestId('admin-halle-absagen')
    expect(knopf).not.toHaveAttribute('aria-disabled')
    expect(knopf).toHaveTextContent('Halle per E-Mail absagen')
  })

  test('Frist erreicht: Text statt Termin, Aktion aria-disabled mit Grund, kein Dialog; der Rest bleibt nutzbar', async () => {
    rendern({ halleAbsageMoeglichBis: '2020-01-01T10:00:00' })

    expect(await screen.findByTestId('admin-halle-frist')).toHaveTextContent('Die Frist für die Hallenabsage ist abgelaufen')
    const knopf = screen.getByTestId('admin-halle-absagen')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).not.toBeDisabled()
    expect(knopf).toHaveAccessibleDescription(/Frist für die Hallenabsage ist abgelaufen/)
    expect(screen.queryByTestId('admin-halle-moeglich')).not.toBeInTheDocument()

    fireEvent.click(knopf)

    dialogZu()
    expect(screen.getByTestId('admin-termin-absagen')).toBeInTheDocument()
  })

  test('keine Adresse: Text mit Link zur Konfiguration, Aktion aria-disabled', async () => {
    rendern({}, { halleEmail: null })

    expect(await screen.findByTestId('admin-halle-adresse-fehlt')).toHaveTextContent('Es ist keine E-Mail-Adresse des Hallenbetreibers hinterlegt.')
    const knopf = screen.getByTestId('admin-halle-absagen')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription(/keine E-Mail-Adresse/)
    fireEvent.click(knopf)
    dialogZu()

    await userEvent.click(screen.getByTestId('admin-halle-zur-konfiguration'))
    expect(await screen.findByTestId('seite-konfiguration')).toBeInTheDocument()
  })

  test('Absage schon versandt: Zeitpunkt statt Aktion, auch bei abgesagtem Termin und ausgeschaltetem Modus', async () => {
    rendern({ status: 'ABGESAGT', halleAbgesagtAm: '2099-01-02T10:00:00Z' }, { hallenModusAktiv: false })

    expect(await screen.findByTestId('admin-halle-versandt')).toHaveTextContent('Die Absage an die Halle wurde am')
    expect(screen.getByTestId('admin-halle-versandt')).toHaveTextContent('versandt.')
    expect(screen.queryByTestId('admin-halle-absagen')).not.toBeInTheDocument()
  })

  test.each([
    ['ABGESCHLOSSEN', null],
    ['ABGESAGT', null],
  ] as const)('Status %s ohne Versandzeitpunkt: kein Abschnitt', async (status, versandt) => {
    rendern({ status, halleAbgesagtAm: versandt })
    await keinAbschnitt()
  })
})

describe('TerminHalle – Absenden', () => {
  async function dialogOeffnen() {
    fireEvent.click(await screen.findByTestId('admin-halle-absagen'))
    return screen.findByTestId('admin-halle-dialog')
  }

  test('der Dialog warnt vor der echten E-Mail und der Unumkehrbarkeit; Abbrechen sendet nichts', async () => {
    const welt = rendern()

    const dialog = await dialogOeffnen()

    expect(dialog).toHaveTextContent('sofort')
    expect(dialog).toHaveTextContent('nicht zurücknehmen')
    expect(dialog).toHaveTextContent('Der Termin wird dabei ebenfalls abgesagt.')
    await userEvent.click(screen.getByTestId('admin-halle-dialog-abbrechen'))
    dialogZu()
    expect(welt.protokoll.halleAbgesagt).toEqual([])
  })

  test('Erfolg: der Termin ist ABGESAGT, der Abschnitt zeigt „versandt“, der Fokus liegt auf der Überschrift', async () => {
    const welt = rendern()

    await dialogOeffnen()
    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-halle-versandt')).toBeInTheDocument()
    expect(welt.protokoll.halleAbgesagt).toEqual([{ terminId: 101 }])
    expect(welt.termine[0].status).toBe('ABGESAGT')
    dialogZu()
    expect(screen.queryByTestId('admin-halle-absagen')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
  })

  test('HALLE_BEREITS_ABGESAGT ist kein Fehler: Dialog zu, „Die Absage ist schon raus.“ und der Zeitpunkt', async () => {
    const welt = rendern()
    await dialogOeffnen()
    // Jemand war schneller: Die Absage ging hinaus, bevor dieses Gerät sie senden konnte.
    welt.termine[0].halleAbgesagtAm = '2099-01-02T10:00:00Z'

    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-halle-nachricht')).toHaveTextContent('Die Absage ist schon raus.')
    expect(await screen.findByTestId('admin-halle-versandt')).toBeInTheDocument()
    dialogZu()
    expect(screen.queryByTestId('admin-halle-dialog-fehler')).not.toBeInTheDocument()
    expect(welt.protokoll.halleAbgesagt).toHaveLength(1)
  })

  test('503: Der Dialog bleibt offen, der Satz „nichts verändert“ steht da, es gibt keinen zweiten Versuch von selbst', async () => {
    const welt = rendern()
    welt.mailFehler = true
    await dialogOeffnen()

    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-halle-dialog-versand')).toHaveTextContent('Es wurde nichts verändert; du kannst es erneut versuchen.')
    expect(screen.getByTestId('admin-halle-dialog-fehler')).toHaveTextContent('Die E-Mail konnte nicht gesendet werden.')
    expect(screen.getByTestId('admin-halle-dialog')).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 150))
    expect(welt.protokoll.halleAbgesagt).toHaveLength(1)
    expect(welt.termine[0].status).toBe('GEPLANT')

    // Von Hand erneut: jetzt geht es.
    welt.mailFehler = false
    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))
    expect(await screen.findByTestId('admin-halle-versandt')).toBeInTheDocument()
    expect(welt.protokoll.halleAbgesagt).toHaveLength(2)
  })

  test('HALLE_MODUS_INAKTIV: Dialog zu, Hinweis, der Abschnitt zeigt die Aktion nicht mehr', async () => {
    const welt = rendern()
    await dialogOeffnen()
    welt.konfiguration.hallenModusAktiv = false

    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-halle-nachricht')).toHaveTextContent('Der Hallenmodus ist abgeschaltet.')
    dialogZu()
    await waitFor(() => expect(screen.queryByTestId('admin-halle-absagen')).not.toBeInTheDocument())
  })

  test('HALLE_FRIST_ABGELAUFEN: Dialog zu, die Aktion ist gesperrt, der Text des Servers steht da', async () => {
    rendern()
    await dialogOeffnen()
    // Der Server sieht die Frist als erreicht, das Gerät (noch) nicht.
    mockServer.use(
      http.post('*/admin/halle/absagen', () => problem(409, 'HALLE_FRIST_ABGELAUFEN', 'Die Absage ist nur bis gestern möglich.')),
    )

    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))

    const frist = await screen.findByTestId('admin-halle-frist')
    expect(frist).toHaveTextContent('Die Absage ist nur bis gestern möglich.')
    expect(screen.getByTestId('admin-halle-absagen')).toHaveAttribute('aria-disabled', 'true')
    dialogZu()
  })

  test('TERMIN_GESCHLOSSEN: Dialog zu und der Hinweis „Der Termin ist abgeschlossen.“', async () => {
    const welt = rendern()
    await dialogOeffnen()
    welt.termine[0].status = 'ABGESCHLOSSEN'

    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-halle-nachricht')).toHaveTextContent('Der Termin ist abgeschlossen.')
    dialogZu()
  })

  test('HALLE_NICHT_KONFIGURIERT: Dialog zu; die gelesene Konfiguration zeigt jetzt den Hinweis auf die fehlende Adresse', async () => {
    const welt = rendern()
    await dialogOeffnen()
    welt.konfiguration.halleEmail = null

    await userEvent.click(screen.getByTestId('admin-halle-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-halle-adresse-fehlt')).toBeInTheDocument()
    dialogZu()
  })
})
