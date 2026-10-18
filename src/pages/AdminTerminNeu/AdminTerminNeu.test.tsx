import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { useTermine } from '@/hooks/useTermine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminTerminNeu from './AdminTerminNeu'

afterEach(() => {
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

function rendern(termine: TerminModell[] = []) {
  const welt = adminWelt({ termine })
  const lesen = terminHandlers(welt.termine)
  mockServer.use(...lesen.handlers, ...adminHandler(welt))
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={['/admin/termine/neu']}>
        <Routes>
          <Route path="/admin/termine/neu" element={<AdminTerminNeu />} />
          <Route path="/admin/termine/:terminId" element={<Ziel />} />
          <Route path="/admin/termine" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

/** Trägt einen Wert in ein Datums- oder Zeitfeld ein (`type` ist dort unzuverlässig). */
function eintragen(testId: string, wert: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value: wert } })
}

/** Füllt den Einzeltermin: Datum und Uhrzeit im Jahr 2099. */
function einzelFuellen(ort?: string) {
  eintragen('termin-datum', '2099-03-02')
  eintragen('termin-uhrzeit', '20:00')
  if (ort !== undefined) eintragen('termin-ort', ort)
}

describe('AdminTerminNeu – Einzeltermin', () => {
  test('zeigt Überschrift, die Art-Auswahl mit „Einzeltermin“ als Vorgabe und die Felder', () => {
    rendern()

    expect(screen.getByRole('heading', { level: 1, name: 'Termin anlegen' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Art' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-art-einzel')).toBeChecked()
    expect(screen.getByTestId('admin-art-serie')).not.toBeChecked()
    expect(screen.getByTestId('termin-datum')).toHaveAttribute('min', heuteIso(new Date()))
  })

  test('ohne Datum und Uhrzeit ist der Knopf aria-disabled mit Grund und sendet nichts', async () => {
    const welt = rendern()
    const knopf = screen.getByTestId('admin-termin-neu-absenden')

    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription('Bitte gib Datum und Uhrzeit ein.')
    await userEvent.click(knopf)

    expect(welt.protokoll.terminAngelegt).toHaveLength(0)
  })

  test('legt an: Körper mit Datum, Uhrzeit und getrimmtem Ort, dann Verwaltung des neuen Termins mit Hinweis', async () => {
    const welt = rendern()
    einzelFuellen('  Beispielhalle ')

    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/termine/101')
    expect(screen.getByTestId('ziel-hinweis')).toHaveTextContent('Termin angelegt.')
    expect(welt.protokoll.terminAngelegt).toEqual([{ datum: '2099-03-02', uhrzeit: '20:00', ort: 'Beispielhalle' }])
  })

  test('ein leerer Ort wird nicht gesendet', async () => {
    const welt = rendern()
    einzelFuellen('   ')

    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    await screen.findByTestId('ziel')
    expect(welt.protokoll.terminAngelegt).toEqual([{ datum: '2099-03-02', uhrzeit: '20:00' }])
  })

  test('TERMIN_BELEGT: Text am Uhrzeitfeld, Fokus dorthin, Eingaben bleiben, kein Seitenwechsel', async () => {
    rendern([terminModell({ terminId: 150, datum: '2099-03-02', uhrzeit: '20:00:00', zusagen: [] })])
    einzelFuellen('Beispielhalle')

    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    expect(await screen.findByTestId('termin-uhrzeit-fehler')).toHaveTextContent(
      'Zu diesem Zeitpunkt gibt es bereits einen Termin (auch an einem anderen Ort).',
    )
    expect(screen.getByTestId('termin-uhrzeit')).toHaveFocus()
    expect(screen.getByTestId('termin-datum')).toHaveValue('2099-03-02')
    expect(screen.getByTestId('termin-ort')).toHaveValue('Beispielhalle')
    expect(screen.queryByTestId('ziel')).not.toBeInTheDocument()
  })

  test('ein Zeitpunkt in der Vergangenheit wird vor dem Senden abgewiesen', async () => {
    const welt = rendern()
    eintragen('termin-datum', heuteIso(new Date()))
    eintragen('termin-uhrzeit', '00:00')

    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    expect(await screen.findByTestId('termin-uhrzeit-fehler')).toHaveTextContent('Dieser Zeitpunkt liegt in der Vergangenheit.')
    expect(welt.protokoll.terminAngelegt).toHaveLength(0)
  })

  test('der Fehler verschwindet mit der nächsten Eingabe', async () => {
    rendern([terminModell({ terminId: 150, datum: '2099-03-02', uhrzeit: '20:00:00', zusagen: [] })])
    einzelFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))
    await screen.findByTestId('termin-uhrzeit-fehler')

    eintragen('termin-uhrzeit', '21:00')

    await waitFor(() => expect(screen.queryByTestId('termin-uhrzeit-fehler')).not.toBeInTheDocument())
  })

  test('400 mit Feldmeldung steht am Feld, 400 ohne Feld als Kasten über der Aktion', async () => {
    rendern()
    mockServer.use(
      http.post('*/admin/termin/anlegen', () => problem(400, 'EINGABE_UNGUELTIG', 'Der Termin darf nicht in der Vergangenheit liegen.')),
    )
    einzelFuellen()

    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    expect(await screen.findByTestId('admin-termin-neu-fehler')).toHaveTextContent('Der Termin darf nicht in der Vergangenheit liegen.')
    expect(screen.getByTestId('termin-datum')).toHaveValue('2099-03-02')
  })

  test('ein Serverfehler 500 zeigt den Kasten und lässt die Eingaben stehen', async () => {
    rendern()
    mockServer.use(http.post('*/admin/termin/anlegen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    einzelFuellen()

    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    expect(await screen.findByTestId('admin-termin-neu-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('termin-uhrzeit')).toHaveValue('20:00')
  })
})

describe('AdminTerminNeu – Serie', () => {
  /** Wechselt zur Serie und füllt alle Felder: dienstags 20:00 vom 01.01. bis 20.01.2099. */
  async function serieFuellen() {
    await userEvent.click(screen.getByTestId('admin-art-serie'))
    await userEvent.type(screen.getByTestId('serie-titel'), 'Beispielserie')
    await userEvent.click(screen.getByTestId('serie-wochentag'))
    await userEvent.click(screen.getByTestId('serie-wochentag-option-2'))
    eintragen('serie-uhrzeit', '20:00')
    eintragen('serie-startdatum', '2099-01-01')
    eintragen('serie-enddatum', '2099-01-20')
  }

  test('der Wechsel behält Datum, Uhrzeit und Ort', async () => {
    rendern()
    einzelFuellen('Beispielhalle')

    await userEvent.click(screen.getByTestId('admin-art-serie'))

    expect(screen.getByTestId('serie-startdatum')).toHaveValue('2099-03-02')
    expect(screen.getByTestId('serie-uhrzeit')).toHaveValue('20:00')
    expect(screen.getByTestId('serie-ort')).toHaveValue('Beispielhalle')
    expect(screen.getByTestId('serie-startdatum')).toHaveAccessibleDescription('Fällt es selbst auf den Wochentag, gehört es zur Serie.')
  })

  test('der Wochentag hat keine Vorauswahl; der Knopf nennt den Grund', async () => {
    rendern()
    await userEvent.click(screen.getByTestId('admin-art-serie'))

    expect(screen.getByTestId('serie-wochentag')).toHaveTextContent('Bitte wählen')
    expect(screen.getByTestId('admin-termin-neu-absenden')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('admin-termin-neu-absenden')).toHaveTextContent('Serie anlegen')
  })

  test('das Enddatum nicht nach dem Startdatum wird sofort am Feld genannt', async () => {
    rendern()
    await userEvent.click(screen.getByTestId('admin-art-serie'))

    eintragen('serie-startdatum', '2099-01-10')
    eintragen('serie-enddatum', '2099-01-10')

    expect(await screen.findByTestId('serie-enddatum-fehler')).toHaveTextContent('Das Enddatum muss nach dem Startdatum liegen.')
  })

  test('der Knopf fragt zuerst: Dialog mit den Folgen, ohne Aufruf', async () => {
    const welt = rendern()
    await userEvent.click(screen.getByTestId('admin-art-serie'))
    await serieFuellen()

    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    const dialog = screen.getByTestId('admin-serie-dialog')
    expect(dialog).toHaveTextContent('Serie anlegen?')
    expect(dialog).toHaveTextContent('Alle passenden Termine werden sofort angelegt, höchstens 52.')
    expect(dialog).toHaveTextContent('Eine Serie lässt sich danach nicht mehr ändern')
    expect(welt.protokoll.serieAngelegt).toHaveLength(0)
  })

  test('Abbrechen schliesst den Dialog, die Eingaben bleiben, es wurde nichts gesendet', async () => {
    const welt = rendern()
    await serieFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    await userEvent.click(screen.getByTestId('admin-serie-dialog-abbrechen'))

    await waitFor(() => expect(screen.getByTestId('admin-serie-dialog')).not.toBeVisible())
    expect(screen.getByTestId('serie-titel')).toHaveValue('Beispielserie')
    expect(welt.protokoll.serieAngelegt).toHaveLength(0)
  })

  test('bestätigt: Körper mit Zahl als Wochentag, dann Ergebnis mit angelegten und übersprungenen Zeitpunkten und Fokus', async () => {
    // Dienstag, 13.01.2099 20:00 ist schon belegt und wird übersprungen.
    const welt = rendern([terminModell({ terminId: 150, datum: '2099-01-13', uhrzeit: '20:00:00', zusagen: [] })])
    await serieFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    await userEvent.click(screen.getByTestId('admin-serie-dialog-bestaetigen'))

    expect(await screen.findByTestId('serie-ergebnis')).toBeInTheDocument()
    expect(welt.protokoll.serieAngelegt).toEqual([
      { titel: 'Beispielserie', wochentag: 2, uhrzeit: '20:00', startdatum: '2099-01-01', enddatum: '2099-01-20' },
    ])
    expect(screen.getByTestId('serie-angelegt-anzahl')).toHaveTextContent('2 Termine angelegt.')
    expect(screen.getByTestId('serie-uebersprungen-2099-01-13')).toBeInTheDocument()
    expect(screen.getByTestId('serie-ergebnis-titel')).toHaveFocus()
    // Das Formular ist ersetzt.
    expect(screen.queryByTestId('serie-formular')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('serie-termine')).getAllByRole('link')).toHaveLength(2)
  })

  test('ohne übersprungene Zeitpunkte nennt das Ergebnis es ausdrücklich', async () => {
    rendern()
    await serieFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    await userEvent.click(screen.getByTestId('admin-serie-dialog-bestaetigen'))

    expect(await screen.findByTestId('serie-uebersprungen-leer')).toBeInTheDocument()
    expect(screen.getByTestId('serie-angelegt-anzahl')).toHaveTextContent('3 Termine angelegt.')
  })

  test('ein Fehler des Servers steht im Dialog, der Dialog bleibt offen', async () => {
    rendern()
    mockServer.use(
      http.post('*/admin/serie/anlegen', () => problem(400, 'EINGABE_UNGUELTIG', 'Im Zeitraum liegt kein passender Wochentag.')),
    )
    await serieFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    await userEvent.click(screen.getByTestId('admin-serie-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-serie-dialog-fehler')).toHaveTextContent('Im Zeitraum liegt kein passender Wochentag.')
    expect(screen.getByTestId('admin-serie-dialog')).toBeVisible()
    expect(screen.queryByTestId('serie-ergebnis')).not.toBeInTheDocument()
  })

  test('nach dem Abbrechen steht der Fehler als Kasten über der Aktion', async () => {
    rendern()
    mockServer.use(http.post('*/admin/serie/anlegen', () => problem(400, 'EINGABE_UNGUELTIG', 'Die Serie umfasst 60 Termine.')))
    await serieFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))
    await userEvent.click(screen.getByTestId('admin-serie-dialog-bestaetigen'))
    await screen.findByTestId('admin-serie-dialog-fehler')

    await userEvent.click(screen.getByTestId('admin-serie-dialog-abbrechen'))

    expect(await screen.findByTestId('admin-termin-neu-fehler')).toHaveTextContent('Die Serie umfasst 60 Termine.')
  })

  test('der Wechsel der Art räumt den Fehler ab', async () => {
    rendern()
    mockServer.use(http.post('*/admin/termin/anlegen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    einzelFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))
    await screen.findByTestId('admin-termin-neu-fehler')

    await userEvent.click(screen.getByTestId('admin-art-serie'))

    expect(screen.queryByTestId('admin-termin-neu-fehler')).not.toBeInTheDocument()
  })
})

describe('AdminTerminNeu – Regression mutateAsync', () => {
  /** Zeigt die Seite nur, solange die Terminliste leer ist: Das Neulesen nach dem Anlegen hängt sie aus. */
  function Aushaenger() {
    const liste = useTermine()
    if (!liste.data || liste.data.length > 0) return <p data-testid="ausgehaengt" />
    return <AdminTerminNeu />
  }

  test('die Weiterleitung geschieht, obwohl das Neulesen die Seite aushängt', async () => {
    const welt = adminWelt({ termine: [] })
    mockServer.use(...terminHandlers(welt.termine).handlers, ...adminHandler(welt))
    render(
      <QueryUmgebung>
        <MemoryRouter initialEntries={['/admin/termine/neu']}>
          <Routes>
            <Route path="/admin/termine/neu" element={<Aushaenger />} />
            <Route path="/admin/termine/:terminId" element={<Ziel />} />
          </Routes>
        </MemoryRouter>
      </QueryUmgebung>,
    )
    await screen.findByTestId('termin-datum')

    einzelFuellen()
    await userEvent.click(screen.getByTestId('admin-termin-neu-absenden'))

    expect(await screen.findByTestId('ziel')).toHaveTextContent('/admin/termine/101')
    expect(screen.getByTestId('ziel-hinweis')).toHaveTextContent('Termin angelegt.')
  })
})
