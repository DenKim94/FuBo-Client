import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { heuteIso } from '@/api/termine/terminZeit'
import { adminHandler, adminWelt } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers, terminModell, type TerminModell } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminTerminDetail from './AdminTerminDetail'

afterEach(() => {
  vi.useRealTimers()
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Zeigt Pfad und Hinweis der Zielseite. */
function Ziel() {
  const ort = useLocation()
  return (
    <>
      <p data-testid="ziel">{ort.pathname}</p>
      <p data-testid="ziel-hinweis">{(ort.state as { hinweis?: string } | null)?.hinweis}</p>
    </>
  )
}

/** Termin 101 ohne Zusagen (entfernbar), 102 mit Zusagen (nicht entfernbar), beide geplant im Jahr 2099. */
function beispiel(): TerminModell[] {
  return [
    terminModell({ terminId: 101, datum: '2099-01-06', uhrzeit: '19:00:00', ort: 'Beispielhalle', zusagen: [] }),
    terminModell({ terminId: 102, datum: '2099-01-13', uhrzeit: '19:00:00' }),
  ]
}

function rendern(pfad = '/admin/termine/101', modelle: TerminModell[] = beispiel(), zustand?: unknown) {
  const welt = adminWelt({ termine: modelle })
  const lesen = terminHandlers(welt.termine)
  mockServer.use(...lesen.handlers, ...adminHandler(welt))
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[{ pathname: pfad, state: zustand }]}>
        <Routes>
          <Route path="/admin/termine/:terminId" element={<AdminTerminDetail />} />
          <Route path="/admin/termine" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return { welt, lesen }
}

/** Trägt einen Wert in ein Datums- oder Zeitfeld ein. */
function eintragen(testId: string, wert: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value: wert } })
}

describe('AdminTerminDetail – Aufbau', () => {
  test('zeigt die Karte als Überschrift, nur lesend, mit den Abschnitten „Termin ändern“ und „Weitere Aktionen“', async () => {
    rendern()

    expect(await screen.findByRole('heading', { level: 1, name: /19:00 Uhr/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Termin ändern' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Weitere Aktionen' })).toBeInTheDocument()
    // Der Admin hat weder Zusagestatus noch Rückmeldeleiste noch eine haftende Aktionsleiste.
    expect(screen.queryByTestId('termin-zusagestatus')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rueckmeldung-zusagen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('aktionsleiste')).not.toBeInTheDocument()
  })

  test('belegt das Formular mit dem Stand des Termins vor', async () => {
    rendern()

    expect(await screen.findByTestId('termin-datum')).toHaveValue('2099-01-06')
    expect(screen.getByTestId('termin-uhrzeit')).toHaveValue('19:00')
    expect(screen.getByTestId('termin-ort')).toHaveValue('Beispielhalle')
  })

  test('liest den Termin einmal, im Hintergrund, ohne Polling', async () => {
    const { lesen } = rendern()
    await screen.findByTestId('termin-datum')

    expect(lesen.protokoll.detailabrufe).toEqual(['true'])
  })

  test('liest nach 60 Sekunden Fake-Zeit nicht ein zweites Mal ab (kein Polling, auch nicht über den Verwaltungsbaustein)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout'], shouldAdvanceTime: true })
    const { lesen } = rendern()
    await screen.findByTestId('admin-termin-verwaltung')

    await vi.advanceTimersByTimeAsync(60_000)

    expect(lesen.protokoll.detailabrufe).toEqual(['true'])
  })

  test('zeigt einen Hinweis aus der Navigation', async () => {
    rendern('/admin/termine/101', beispiel(), { hinweis: 'Termin angelegt.' })

    expect(await screen.findByTestId('admin-termin-hinweis')).toHaveTextContent('Termin angelegt.')
  })

  test.each(['abc', '0', '-1', '1.5'])('eine ungültige Id „%s“ zeigt „nicht gefunden“ ohne Abruf', (id) => {
    const { lesen } = rendern(`/admin/termine/${id}`)

    expect(screen.getByTestId('nicht-gefunden')).toBeInTheDocument()
    expect(lesen.protokoll.detailabrufe).toHaveLength(0)
  })

  test('ein unbekannter Termin zeigt den Leerzustand der Ansicht, ohne Abschnitte', async () => {
    rendern('/admin/termine/999')

    expect(await screen.findByTestId('termin-nicht-gefunden')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-verwaltung')).not.toBeInTheDocument()
  })

  test('ein abgesagter Termin bietet nur „Termin entfernen“ an, kein Formular', async () => {
    rendern('/admin/termine/101', [terminModell({ terminId: 101, status: 'ABGESAGT', zusagen: [] })])

    expect(await screen.findByTestId('admin-termin-entfernen')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-aendern')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-abschliessen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-absagen')).not.toBeInTheDocument()
  })

  test('ein abgeschlossener Termin hat in C7 weder Formular noch Aktionen', async () => {
    rendern('/admin/termine/101', [terminModell({ terminId: 101, status: 'ABGESCHLOSSEN' })])

    expect(await screen.findByTestId('termin-abgeschlossen')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-aendern')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-aktionen')).not.toBeInTheDocument()
  })
})

describe('AdminTerminDetail – Termin ändern', () => {
  test('ohne Änderung ist „Änderungen speichern“ aria-disabled mit Grund und sendet nichts', async () => {
    const { welt } = rendern()
    const knopf = await screen.findByTestId('admin-termin-speichern')

    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription('Es gibt keine Änderung.')
    await userEvent.click(knopf)

    expect(welt.protokoll.terminGeaendert).toHaveLength(0)
  })

  test('nennt die Folgen einer Verschiebung unter den Feldern', async () => {
    rendern()

    expect(await screen.findByTestId('admin-termin-aendern-folgen')).toHaveTextContent(
      'Eine Verschiebung von Datum oder Uhrzeit setzt die Fixierung der Teams zurück und löst die Erinnerung neu aus.',
    )
  })

  test('sendet nur das Geänderte samt version; danach „Gespeichert.“, das Formular zeigt den neuen Stand, der Fokus bleibt am Knopf', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-ort')

    await userEvent.clear(screen.getByTestId('termin-ort'))
    await userEvent.type(screen.getByTestId('termin-ort'), 'Neue Halle')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    expect(await screen.findByTestId('admin-termin-gespeichert')).toHaveTextContent('Gespeichert.')
    expect(welt.protokoll.terminGeaendert).toEqual([{ terminId: 101, version: 1, ort: 'Neue Halle' }])
    await waitFor(() => expect(screen.getByTestId('admin-termin-speichern')).toHaveFocus())
    expect(screen.getByTestId('termin-ort')).toHaveValue('Neue Halle')
    // Ohne weitere Änderung ist der Knopf wieder gesperrt; der nächste Stand trägt die neue version.
    expect(screen.getByTestId('admin-termin-speichern')).toHaveAttribute('aria-disabled', 'true')
  })

  test('ein geleerter Ort geht als "" hinaus, nicht als null', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-ort')

    await userEvent.clear(screen.getByTestId('termin-ort'))
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    await screen.findByTestId('admin-termin-gespeichert')
    expect(welt.protokoll.terminGeaendert).toEqual([{ terminId: 101, version: 1, ort: '' }])
  })

  test('die nächste Eingabe nimmt „Gespeichert.“ wieder weg', async () => {
    rendern()
    await screen.findByTestId('termin-ort')
    await userEvent.type(screen.getByTestId('termin-ort'), 'x')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))
    await screen.findByTestId('admin-termin-gespeichert')

    await userEvent.type(screen.getByTestId('termin-ort'), 'y')

    expect(screen.queryByTestId('admin-termin-gespeichert')).not.toBeInTheDocument()
  })

  test('E5: DATEN_VERALTET setzt das Formular auf den frischen Stand zurück, sagt es, und sendet nicht erneut', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-ort')
    welt.fremdeAenderung(101, { ort: 'Fremde Halle' })

    eintragen('termin-datum', '2099-02-10')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    expect(await screen.findByTestId('admin-termin-veraltet')).toHaveTextContent(
      'Der Termin wurde zwischenzeitlich geändert. Deine Eingaben wurden zurückgesetzt; bitte prüfe den aktuellen Stand und ändere erneut.',
    )
    // Frischer Stand, eigene Eingabe weg.
    await waitFor(() => expect(screen.getByTestId('termin-ort')).toHaveValue('Fremde Halle'))
    expect(screen.getByTestId('termin-datum')).toHaveValue('2099-01-06')
    expect(welt.protokoll.terminGeaendert).toHaveLength(1)
  })

  test('E5: der Text zur Veraltung verschwindet mit der nächsten Eingabe', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-ort')
    welt.fremdeAenderung(101, { ort: 'Fremde Halle' })
    eintragen('termin-datum', '2099-02-10')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))
    await screen.findByTestId('admin-termin-veraltet')
    await waitFor(() => expect(screen.getByTestId('termin-ort')).toHaveValue('Fremde Halle'))

    await userEvent.type(screen.getByTestId('termin-ort'), '!')

    expect(screen.queryByTestId('admin-termin-veraltet')).not.toBeInTheDocument()
  })

  test('E5: nach dem Neuaufbau geht die neue version mit; das erneute Speichern gelingt', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-ort')
    welt.fremdeAenderung(101, { ort: 'Fremde Halle' })
    eintragen('termin-datum', '2099-02-10')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))
    await screen.findByTestId('admin-termin-veraltet')
    await waitFor(() => expect(screen.getByTestId('termin-datum')).toHaveValue('2099-01-06'))

    eintragen('termin-datum', '2099-02-10')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    await screen.findByTestId('admin-termin-gespeichert')
    expect(welt.protokoll.terminGeaendert[1]).toEqual({ terminId: 101, version: 2, datum: '2099-02-10' })
  })

  test('TERMIN_BELEGT steht am Uhrzeitfeld, der Fokus geht dorthin, die Eingaben bleiben', async () => {
    rendern()
    await screen.findByTestId('termin-datum')

    eintragen('termin-datum', '2099-01-13')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    expect(await screen.findByTestId('termin-uhrzeit-fehler')).toHaveTextContent(
      'Zu diesem Zeitpunkt gibt es bereits einen Termin (auch an einem anderen Ort).',
    )
    expect(screen.getByTestId('termin-uhrzeit')).toHaveFocus()
    expect(screen.getByTestId('termin-datum')).toHaveValue('2099-01-13')
  })

  test('ein Zeitpunkt in der Vergangenheit wird vor dem Senden abgewiesen', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-datum')

    eintragen('termin-datum', heuteIso(new Date()))
    eintragen('termin-uhrzeit', '00:00')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    expect(await screen.findByTestId('termin-uhrzeit-fehler')).toHaveTextContent('Dieser Zeitpunkt liegt in der Vergangenheit.')
    expect(welt.protokoll.terminGeaendert).toHaveLength(0)
  })

  test('TERMIN_GESCHLOSSEN: Hinweis „nicht mehr geplant“, der Abschnitt verschwindet', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-ort')
    welt.fremdeAenderung(101, { status: 'ABGESAGT' })

    await userEvent.type(screen.getByTestId('termin-ort'), 'x')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    expect(await screen.findByTestId('admin-termin-nicht-mehr-geplant')).toHaveTextContent('Der Termin ist nicht mehr geplant.')
    await waitFor(() => expect(screen.queryByTestId('admin-termin-aendern')).not.toBeInTheDocument())
    expect(screen.getByTestId('termin-abgesagt')).toBeInTheDocument()
  })

  test('ein Serverfehler 500 steht als Kasten, die Eingaben bleiben', async () => {
    rendern()
    mockServer.use(http.post('*/admin/termin/aendern', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    await screen.findByTestId('termin-ort')

    await userEvent.type(screen.getByTestId('termin-ort'), 'x')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    expect(await screen.findByTestId('admin-termin-aendern-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('termin-ort')).toHaveValue('Beispielhallex')
  })
})

describe('AdminTerminDetail – Weitere Aktionen', () => {
  test('„Termin abschließen“ nennt die Folgen, sendet status und version, und der Fokus geht auf die Überschrift', async () => {
    const { welt } = rendern()
    await userEvent.click(await screen.findByTestId('admin-termin-abschliessen'))

    expect(screen.getByTestId('admin-abschliessen-dialog')).toHaveTextContent('Das lässt sich nicht rückgängig machen.')
    await userEvent.click(screen.getByTestId('admin-abschliessen-dialog-bestaetigen'))

    expect(await screen.findByTestId('termin-abgeschlossen')).toBeInTheDocument()
    expect(welt.protokoll.terminGeaendert).toEqual([{ terminId: 101, version: 1, status: 'ABGESCHLOSSEN' }])
    expect(screen.queryByTestId('admin-abschliessen-dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-aktionen')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
  })

  test('„Termin absagen“ nennt die Folgen, sendet nur die Id, der Termin zeigt „abgesagt“, nur „entfernen“ bleibt', async () => {
    const { welt } = rendern()
    await userEvent.click(await screen.findByTestId('admin-termin-absagen'))

    expect(screen.getByTestId('admin-absagen-dialog')).toHaveTextContent('Die Absage ist endgültig.')
    await userEvent.click(screen.getByTestId('admin-absagen-dialog-bestaetigen'))

    expect(await screen.findByTestId('termin-abgesagt')).toBeInTheDocument()
    expect(welt.protokoll.terminAbgesagt).toEqual([{ terminId: 101 }])
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus())
    expect(screen.getByTestId('admin-termin-entfernen')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-absagen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-termin-aendern')).not.toBeInTheDocument()
  })

  test('„Abbrechen“ schließt den Dialog, ohne etwas zu senden', async () => {
    const { welt } = rendern()
    await userEvent.click(await screen.findByTestId('admin-termin-absagen'))
    await userEvent.click(screen.getByTestId('admin-absagen-dialog-abbrechen'))

    expect(screen.getByTestId('admin-absagen-dialog')).not.toBeVisible()
    expect(welt.protokoll.terminAbgesagt).toHaveLength(0)
  })

  test('ein Fehler beim Absagen bleibt im Dialog sichtbar, der Dialog bleibt offen', async () => {
    rendern()
    mockServer.use(http.post('*/admin/termin/absagen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    await userEvent.click(await screen.findByTestId('admin-termin-absagen'))
    await userEvent.click(screen.getByTestId('admin-absagen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-absagen-dialog-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('admin-absagen-dialog')).toBeInTheDocument()
  })

  test('ein Fehler beim Abschließen bleibt im Dialog sichtbar, der Dialog bleibt offen', async () => {
    rendern()
    mockServer.use(http.post('*/admin/termin/aendern', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    await userEvent.click(await screen.findByTestId('admin-termin-abschliessen'))
    await userEvent.click(screen.getByTestId('admin-abschliessen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-abschliessen-dialog-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('admin-abschliessen-dialog')).toBeInTheDocument()
  })

  test('„Termin entfernen“ nennt die Folgen; Erfolg führt mit Hinweis zur Liste', async () => {
    const { welt } = rendern()
    await userEvent.click(await screen.findByTestId('admin-termin-entfernen'))

    expect(screen.getByTestId('admin-entfernen-dialog')).toHaveTextContent('es bleibt nur der Protokolleintrag')
    await userEvent.click(screen.getByTestId('admin-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/termine')
    expect(screen.getByTestId('ziel-hinweis')).toHaveTextContent('Termin entfernt.')
    expect(welt.protokoll.terminEntfernt).toEqual([{ terminId: 101 }])
  })

  test('ein Fehler beim Entfernen bleibt im Dialog sichtbar, ohne Weiterleitung', async () => {
    rendern()
    mockServer.use(http.post('*/admin/termin/entfernen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    await userEvent.click(await screen.findByTestId('admin-termin-entfernen'))
    await userEvent.click(screen.getByTestId('admin-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-entfernen-dialog-fehler')).toBeInTheDocument()
    expect(screen.queryByTestId('ziel')).not.toBeInTheDocument()
  })

  test('TERMIN_IN_VERWENDUNG schließt den Dialog, nennt den Grund und bietet „Stattdessen absagen“ an', async () => {
    rendern('/admin/termine/102')
    await userEvent.click(await screen.findByTestId('admin-termin-entfernen'))
    await userEvent.click(screen.getByTestId('admin-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-termin-in-verwendung')).toHaveTextContent(
      'Am Termin hängen Rückmeldungen oder Teams; er lässt sich nicht entfernen.',
    )
    expect(screen.getByTestId('admin-entfernen-dialog')).not.toBeVisible()
    expect(screen.queryByTestId('ziel')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('admin-termin-stattdessen-absagen'))
    expect(screen.getByTestId('admin-absagen-dialog')).toBeVisible()
  })

  test('bei einem abgesagten Termin in Verwendung fehlt „Stattdessen absagen“', async () => {
    rendern('/admin/termine/102', [
      terminModell({ terminId: 102, datum: '2099-01-13', uhrzeit: '19:00:00', status: 'ABGESAGT' }),
    ])
    await userEvent.click(await screen.findByTestId('admin-termin-entfernen'))
    await userEvent.click(screen.getByTestId('admin-entfernen-dialog-bestaetigen'))

    await screen.findByTestId('admin-termin-in-verwendung')
    expect(screen.queryByTestId('admin-termin-stattdessen-absagen')).not.toBeInTheDocument()
  })

  test('404 beim Entfernen führt mit Hinweis zur Liste', async () => {
    const { welt } = rendern()
    await screen.findByTestId('admin-termin-entfernen')
    welt.termine.splice(0, welt.termine.length)

    await userEvent.click(screen.getByTestId('admin-termin-entfernen'))
    await userEvent.click(screen.getByTestId('admin-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/termine')
    expect(screen.getByTestId('ziel-hinweis')).toHaveTextContent('Der Termin existiert nicht mehr.')
  })

  test('der Termin verschwindet später (404 beim Neuladen): Hinweis und Link zur Liste statt der Abschnitte', async () => {
    const { welt } = rendern()
    await screen.findByTestId('termin-ort')
    welt.termine.splice(0, welt.termine.length)

    await userEvent.type(screen.getByTestId('termin-ort'), 'x')
    await userEvent.click(screen.getByTestId('admin-termin-speichern'))

    expect(await screen.findByTestId('admin-termin-verschwunden')).toBeInTheDocument()
    expect(screen.getByTestId('admin-termin-zur-liste')).toHaveAttribute('href', '/admin/termine')
    expect(screen.queryByTestId('admin-termin-aendern')).not.toBeInTheDocument()
  })

  test('Regression mutateAsync: Entfernen aus der ausgehängten Seite wirft keinen unbehandelten Fehler', async () => {
    const fehler: unknown[] = []
    const merker = (e: PromiseRejectionEvent) => fehler.push(e.reason)
    window.addEventListener('unhandledrejection', merker)
    const { welt } = rendern()
    await userEvent.click(await screen.findByTestId('admin-termin-entfernen'))
    await userEvent.click(screen.getByTestId('admin-entfernen-dialog-bestaetigen'))
    await screen.findByTestId('ziel')
    await new Promise((r) => setTimeout(r, 50))
    window.removeEventListener('unhandledrejection', merker)

    expect(fehler).toEqual([])
    expect(welt.protokoll.terminEntfernt).toHaveLength(1)
  })
})
