import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { schluessel } from '@/api/common/schluessel'
import { adminHandler, adminWelt, type AdminWelt } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminProfilFormular from './AdminProfilFormular'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Zeigt Pfad und Zustand der Zielseite (Liste). */
function Liste() {
  const ort = useLocation()
  return <p data-testid="liste">{`${ort.pathname}|${JSON.stringify(ort.state)}`}</p>
}

/** Installiert die Admin-Welt; Überschreibungen eines Tests müssen **danach** folgen (der zuletzt angemeldete Handler gewinnt). */
function bereitstellen(welt = adminWelt()) {
  mockServer.use(...adminHandler(welt))
  return welt
}

function rendern(pfad: string, welt: AdminWelt) {
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[pfad]}>
        <Routes>
          <Route path="/admin/profile" element={<Liste />} />
          <Route path="/admin/profile/neu" element={<AdminProfilFormular modus="neu" />} />
          <Route path="/admin/profile/:spielerId" element={<AdminProfilFormular modus="bearbeiten" />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

/** Tippt in ein Feld (Zahlenfelder nehmen Text als `value`). */
function eingeben(testId: string, wert: string) {
  fireEvent.change(screen.getByTestId(testId), { target: { value: wert } })
}

/** Antwort `400` mit Feldmeldungen. */
function eingabeUngueltig(felder: Record<string, string>) {
  return HttpResponse.json(
    { type: 'about:blank', status: 400, code: 'EINGABE_UNGUELTIG', detail: 'Die Eingabe ist ungültig.', felder },
    { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

describe('Anlegen', () => {
  test('zeigt Überschrift, vorbelegte Werte (Mitte der Skala) und den Hinweis dazu', async () => {
    rendern('/admin/profile/neu', bereitstellen())

    expect(await screen.findByRole('heading', { level: 1, name: 'Profil anlegen' })).toBeInTheDocument()
    expect(screen.getByTestId('skill-ANGRIFF')).toHaveValue(3)
    expect(screen.getByTestId('skill-TORWART')).toHaveValue(2)
    expect(screen.getByTestId('skill-vorbelegt-hinweis')).toHaveTextContent('Bitte prüfe jeden Wert.')
    expect(screen.getByTestId('admin-profil-name')).toHaveValue('')
  })

  test('baut die Felder aus den Kategorien des Servers (nichts fest verdrahtet)', async () => {
    const welt = adminWelt({
      skillKategorien: [
        { schluessel: 'KONDITION', bezeichnung: 'Kondition', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 10 },
        { schluessel: 'TECHNIK', bezeichnung: 'Technik', gewicht: 1, reihenfolge: 2, minWert: 1, maxWert: 4 },
      ],
    })
    rendern('/admin/profile/neu', bereitstellen(welt))

    expect(await screen.findByTestId('skill-KONDITION')).toHaveValue(5)
    expect(screen.getByTestId('skill-TECHNIK')).toHaveValue(3)
    expect(screen.queryByTestId('skill-ANGRIFF')).not.toBeInTheDocument()
  })

  test('„Profil anlegen“ ist gesperrt, solange der Name fehlt; der Grund steht als Text', async () => {
    rendern('/admin/profile/neu', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    const knopf = screen.getByTestId('admin-profil-speichern')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription('Bitte gib einen Namen ein.')

    eingeben('admin-profil-name', 'Beispielspieler 09')
    expect(knopf).not.toHaveAttribute('aria-disabled')
  })

  test('ein Wert ausserhalb des Bereichs oder ein leeres Skillfeld sperrt', async () => {
    rendern('/admin/profile/neu', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', 'Beispielspieler 09')
    const knopf = screen.getByTestId('admin-profil-speichern')

    eingeben('skill-TORWART', '4')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription('Bitte prüfe die Skillwerte.')

    eingeben('skill-TORWART', '')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')

    eingeben('skill-TORWART', '0')
    expect(knopf).not.toHaveAttribute('aria-disabled')
  })

  test('sendet den getrimmten Namen und ALLE Kategorien, danach geht es mit Hinweis zur Liste', async () => {
    const welt = rendern('/admin/profile/neu', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', '  Beispielspieler 09  ')
    eingeben('skill-ANGRIFF', '6')

    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    const liste = await screen.findByTestId('liste')
    expect(welt.protokoll.angelegt).toEqual([
      {
        name: 'Beispielspieler 09',
        skills: { ANGRIFF: 6, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 },
      },
    ])
    expect(liste).toHaveTextContent('/admin/profile')
    expect(liste).toHaveTextContent('Profil „Beispielspieler 09“ angelegt.')
  })

  test('409 NAME_BELEGT: Text am Namensfeld, Fokus dort, Eingaben bleiben', async () => {
    rendern('/admin/profile/neu', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', 'BEISPIELSPIELER 01')
    eingeben('skill-ANGRIFF', '5')

    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    expect(await screen.findByTestId('admin-profil-name-fehler')).toHaveTextContent('Dieser Name ist bereits vergeben.')
    await waitFor(() => expect(screen.getByTestId('admin-profil-name')).toHaveFocus())
    expect(screen.getByTestId('admin-profil-name')).toHaveValue('BEISPIELSPIELER 01')
    expect(screen.getByTestId('skill-ANGRIFF')).toHaveValue(5)
    expect(screen.queryByTestId('admin-profil-fehler')).not.toBeInTheDocument()
  })

  test('400 zu den Skillwerten: Kasten über dem Skillblock', async () => {
    const welt = bereitstellen()
    mockServer.use(
      http.post('*/admin/user/anlegen', () =>
        problem(400, 'EINGABE_UNGUELTIG', 'Der Wert für Torwart muss zwischen 0 und 3 liegen.'),
      ),
    )
    rendern('/admin/profile/neu', welt)
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', 'Beispielspieler 09')

    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    expect(await screen.findByTestId('admin-profil-skills-fehler')).toHaveTextContent(
      'Der Wert für Torwart muss zwischen 0 und 3 liegen.',
    )
    expect(screen.getByTestId('admin-profil-name')).toHaveValue('Beispielspieler 09')
  })

  test('400 mit felder.name: Text am Namensfeld', async () => {
    const welt = bereitstellen()
    mockServer.use(http.post('*/admin/user/anlegen', () => eingabeUngueltig({ name: 'Der Name darf nicht leer sein.' })))
    rendern('/admin/profile/neu', welt)
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', 'x')

    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    expect(await screen.findByTestId('admin-profil-name-fehler')).toHaveTextContent('Der Name darf nicht leer sein.')
  })

  test('500: Meldung über der Aktion, Eingaben bleiben; die nächste Eingabe nimmt sie weg', async () => {
    const welt = bereitstellen()
    mockServer.use(
      http.post('*/admin/user/anlegen', () => problem(500, 'INTERNER_FEHLER', 'Es ist ein interner Fehler aufgetreten.')),
    )
    rendern('/admin/profile/neu', welt)
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', 'Beispielspieler 09')

    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    expect(await screen.findByTestId('admin-profil-fehler')).toHaveTextContent('Es ist ein interner Fehler aufgetreten.')
    eingeben('admin-profil-name', 'Beispielspieler 10')
    expect(screen.queryByTestId('admin-profil-fehler')).not.toBeInTheDocument()
  })

  test('Kategorien: Spinner beim Laden, Fehlerzustand bei Ausfall (es wird nichts geraten)', async () => {
    const welt = bereitstellen()
    mockServer.use(http.get('*/admin/skills/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    rendern('/admin/profile/neu', welt)

    expect(screen.getByText('Formular wird geladen')).toBeInTheDocument()
    expect(await screen.findByTestId('admin-profil-kategorien-fehler', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.queryByTestId('admin-profil-formular')).not.toBeInTheDocument()
  })

  test('401 SESSION_UNGUELTIG beendet die Sitzung global', async () => {
    const welt = bereitstellen()
    mockServer.use(http.post('*/admin/user/anlegen', () => problem(401, 'SESSION_UNGUELTIG', 'Abgelaufen.')))
    let beendet = 0
    sitzungsendeBehandeln(() => {
      beendet += 1
    })
    rendern('/admin/profile/neu', welt)
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', 'Beispielspieler 09')

    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    await waitFor(() => expect(beendet).toBe(1))
  })
})

describe('Bearbeiten', () => {
  test('eine ungültige Id ist „nicht gefunden“ und löst keinen Abruf aus', () => {
    for (const roh of ['abc', '0', '-1', '1.5']) {
      queryClient.clear()
      const welt = bereitstellen()
      const { unmount } = render(
        <QueryUmgebung>
          <MemoryRouter initialEntries={[`/admin/profile/${roh}`]}>
            <Routes>
              <Route path="/admin/profile/:spielerId" element={<AdminProfilFormular modus="bearbeiten" />} />
            </Routes>
          </MemoryRouter>
        </QueryUmgebung>,
      )

      expect(screen.getByTestId('nicht-gefunden')).toBeInTheDocument()
      expect(welt.protokoll.profilAbrufe).toHaveLength(0)
      expect(welt.protokoll.skillAbrufe).toHaveLength(0)
      unmount()
    }
  })

  test('ein unbekanntes Profil: „Profil nicht gefunden“ nach dem Laden, mit Link zur Liste', async () => {
    rendern('/admin/profile/777', bereitstellen())

    expect(await screen.findByTestId('admin-profil-nicht-gefunden')).toHaveTextContent('Profil nicht gefunden')
    expect(screen.getByTestId('admin-profil-zur-liste')).toHaveAttribute('href', '/admin/profile')
  })

  test('zeigt Name und Skillwerte; Speichern ist gesperrt, solange nichts geändert ist', async () => {
    rendern('/admin/profile/1', bereitstellen())

    expect(await screen.findByRole('heading', { level: 1, name: 'Beispielspieler 01' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-profil-name')).toHaveValue('Beispielspieler 01')
    expect(screen.getByTestId('skill-ANGRIFF')).toHaveValue(3)
    expect(screen.queryByTestId('skill-vorbelegt-hinweis')).not.toBeInTheDocument()
    const knopf = screen.getByTestId('admin-profil-speichern')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription('Es gibt keine Änderungen.')
  })

  test('sendet nur das Geänderte: eine Kategorie', async () => {
    const welt = rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    eingeben('skill-ANGRIFF', '5')
    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    await waitFor(() => expect(welt.protokoll.bearbeitet).toHaveLength(1))
    expect(welt.protokoll.bearbeitet[0]).toEqual({ spielerId: 1, skills: { ANGRIFF: 5 } })
  })

  test('sendet nur das Geänderte: Name und Kategorie, Name getrimmt', async () => {
    const welt = rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    eingeben('admin-profil-name', '  Beispielspieler 11 ')
    eingeben('skill-TORWART', '0')
    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    await waitFor(() => expect(welt.protokoll.bearbeitet).toHaveLength(1))
    expect(welt.protokoll.bearbeitet[0]).toEqual({ spielerId: 1, name: 'Beispielspieler 11', skills: { TORWART: 0 } })
  })

  test('eine reine Änderung der Gross- und Kleinschreibung wird gesendet', async () => {
    const welt = rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    eingeben('admin-profil-name', 'BEISPIELSPIELER 01')
    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    await waitFor(() => expect(welt.protokoll.bearbeitet).toHaveLength(1))
    expect(welt.protokoll.bearbeitet[0]).toEqual({ spielerId: 1, name: 'BEISPIELSPIELER 01' })
  })

  test('nach dem Speichern: „Gespeichert.“, neuer Stand, Fokus bleibt auf der Schaltfläche', async () => {
    rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('skill-ANGRIFF', '5')
    const knopf = screen.getByTestId('admin-profil-speichern')
    knopf.focus()

    await userEvent.click(knopf)

    expect(await screen.findByTestId('admin-profil-gespeichert')).toHaveTextContent('Gespeichert.')
    expect(screen.getByTestId('admin-profil-gespeichert')).toHaveAttribute('role', 'status')
    expect(screen.getByTestId('skill-ANGRIFF')).toHaveValue(5)
    expect(screen.getByTestId('admin-profil-speichern')).toBe(knopf)
    expect(knopf).toHaveFocus()
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
  })

  test('die nächste Eingabe nimmt „Gespeichert.“ weg', async () => {
    rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('skill-ANGRIFF', '5')
    await userEvent.click(screen.getByTestId('admin-profil-speichern'))
    await screen.findByTestId('admin-profil-gespeichert')

    eingeben('skill-ANGRIFF', '4')

    expect(screen.queryByTestId('admin-profil-gespeichert')).not.toBeInTheDocument()
  })

  test('Lücke in der Karte: „Noch nicht bewertet“, leer; gesendet wird sie nur mit eingetragenem Wert', async () => {
    const welt = rendern('/admin/profile/4', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    expect(screen.getByTestId('skill-TORWART')).toHaveValue(null)
    expect(screen.getByLabelText('Torwart')).toHaveAccessibleDescription('Noch nicht bewertet. 0 bis 3')
    expect(screen.getByLabelText('Angriff')).toHaveAccessibleDescription('0 bis 6')
    // Leere Felder allein sind keine Änderung.
    expect(screen.getByTestId('admin-profil-speichern')).toHaveAttribute('aria-disabled', 'true')

    eingeben('skill-TORWART', '1')
    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    await waitFor(() => expect(welt.protokoll.bearbeitet).toHaveLength(1))
    expect(welt.protokoll.bearbeitet[0]).toEqual({ spielerId: 4, skills: { TORWART: 1 } })
  })

  test('ein ungültiger Wert sperrt das Speichern', async () => {
    rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    eingeben('admin-profil-name', 'Beispielspieler 11')
    eingeben('skill-ANGRIFF', '9')

    const knopf = screen.getByTestId('admin-profil-speichern')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(knopf).toHaveAccessibleDescription('Bitte prüfe die Eingaben.')
  })

  test('ein leerer Name sperrt das Speichern', async () => {
    rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    eingeben('admin-profil-name', '   ')

    expect(screen.getByTestId('admin-profil-speichern')).toHaveAttribute('aria-disabled', 'true')
  })

  test('409 NAME_BELEGT: Text am Namensfeld, Fokus dort', async () => {
    rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')

    eingeben('admin-profil-name', 'beispielspieler 02')
    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    expect(await screen.findByTestId('admin-profil-name-fehler')).toHaveTextContent('Dieser Name ist bereits vergeben.')
    await waitFor(() => expect(screen.getByTestId('admin-profil-name')).toHaveFocus())
  })

  test('404 beim Speichern: zurück zur Liste mit Hinweis', async () => {
    const welt = rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')
    welt.profile = welt.profile.filter((p) => p.spielerId !== 1)
    eingeben('skill-ANGRIFF', '5')

    await userEvent.click(screen.getByTestId('admin-profil-speichern'))

    expect(await screen.findByTestId('liste')).toHaveTextContent('Dieses Profil gibt es nicht mehr.')
  })

  test('ändert sich das Profil unter dem Formular, zeigen die Felder den neuen Stand', async () => {
    const welt = rendern('/admin/profile/1', bereitstellen())
    await screen.findByTestId('skill-ANGRIFF')
    eingeben('admin-profil-name', 'Halb getippt')

    welt.fremdeProfilAenderung(1, { skills: { ANGRIFF: 6, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 } })
    await queryClient.invalidateQueries({ queryKey: schluessel.adminProfile })

    await waitFor(() => expect(screen.getByTestId('skill-ANGRIFF')).toHaveValue(6))
    // Der neue Stand ersetzt die Eingaben; es wird nie mit alten Eingaben auf neuem Stand gesendet.
    expect(screen.getByTestId('admin-profil-name')).toHaveValue('Beispielspieler 01')
  })

  test('das Adminprofil hat kein Formular, kein Sperren, kein Entfernen, aber einen Link zum Anmeldenamen', async () => {
    rendern('/admin/profile/99', bereitstellen())

    expect(await screen.findByTestId('admin-profil-admin-hinweis')).toHaveTextContent(
      'Das Adminprofil wird über den Anmeldenamen umbenannt.',
    )
    expect(screen.getByTestId('admin-profil-admin-namenlink')).toHaveAttribute('href', '/admin/name/aendern')
    expect(screen.queryByTestId('admin-profil-formular')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-profil-sperren')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-profil-entfernen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('skill-felder')).not.toBeInTheDocument()
  })
})

describe('Status: Sperren und Entfernen', () => {
  test('sperrt ein Profil, das nicht online ist, ohne Dialog; die Schaltfläche bleibt dasselbe Element', async () => {
    const welt = rendern('/admin/profile/1', bereitstellen())
    const knopf = await screen.findByTestId('admin-profil-sperren')
    knopf.focus()
    expect(knopf).toHaveTextContent('Profil sperren')

    await userEvent.click(knopf)

    await waitFor(() => expect(welt.protokoll.blockiert).toEqual([{ spielerId: 1, blockieren: true }]))
    await waitFor(() => expect(screen.getByTestId('admin-profil-sperren')).toHaveTextContent('Profil entsperren'))
    expect(screen.getByTestId('admin-profil-sperren')).toBe(knopf)
    expect(knopf).toHaveFocus()
    expect(screen.getByTestId('admin-profil-sperre-text')).toHaveTextContent(
      'Gesperrt: erscheint nicht mehr in der Namensauswahl',
    )
    expect((screen.getByTestId('admin-profil-sperr-dialog') as HTMLDialogElement).open).toBe(false)
  })

  test('sperrt ein angemeldetes Profil erst nach der Bestätigung', async () => {
    const welt = rendern('/admin/profile/3', bereitstellen())
    await userEvent.click(await screen.findByTestId('admin-profil-sperren'))

    const dialog = screen.getByTestId('admin-profil-sperr-dialog') as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(dialog).toHaveTextContent('Beispielspieler 03 ist gerade angemeldet und wird sofort abgemeldet.')
    expect(welt.protokoll.blockiert).toHaveLength(0)

    await userEvent.click(screen.getByTestId('admin-profil-sperr-dialog-bestaetigen'))

    await waitFor(() => expect(welt.protokoll.blockiert).toEqual([{ spielerId: 3, blockieren: true }]))
    await waitFor(() => expect(dialog.open).toBe(false))
  })

  test('Abbrechen im Sperr-Dialog sendet nichts', async () => {
    const welt = rendern('/admin/profile/3', bereitstellen())
    await userEvent.click(await screen.findByTestId('admin-profil-sperren'))

    await userEvent.click(screen.getByTestId('admin-profil-sperr-dialog-abbrechen'))

    expect((screen.getByTestId('admin-profil-sperr-dialog') as HTMLDialogElement).open).toBe(false)
    expect(welt.protokoll.blockiert).toHaveLength(0)
  })

  test('entsperrt ohne Dialog', async () => {
    const welt = rendern('/admin/profile/2', bereitstellen())
    const knopf = await screen.findByTestId('admin-profil-sperren')
    expect(knopf).toHaveTextContent('Profil entsperren')

    await userEvent.click(knopf)

    await waitFor(() => expect(welt.protokoll.blockiert).toEqual([{ spielerId: 2, blockieren: false }]))
    expect((screen.getByTestId('admin-profil-sperr-dialog') as HTMLDialogElement).open).toBe(false)
    await waitFor(() => expect(knopf).toHaveTextContent('Profil sperren'))
  })

  test('ein Fehler beim Sperren steht im Abschnitt', async () => {
    const welt = bereitstellen()
    mockServer.use(
      http.post('*/admin/user/blockieren', () => problem(500, 'INTERNER_FEHLER', 'Es ist ein interner Fehler aufgetreten.')),
    )
    rendern('/admin/profile/1', welt)

    await userEvent.click(await screen.findByTestId('admin-profil-sperren'))

    expect(await screen.findByTestId('admin-profil-status-fehler')).toHaveTextContent(
      'Es ist ein interner Fehler aufgetreten.',
    )
  })

  test('Entfernen verlangt die Bestätigung und nennt die Folgen; danach geht es mit Hinweis zur Liste', async () => {
    const welt = rendern('/admin/profile/5', bereitstellen())
    await userEvent.click(await screen.findByTestId('admin-profil-entfernen'))

    const dialog = screen.getByTestId('admin-profil-entfernen-dialog') as HTMLDialogElement
    expect(dialog.open).toBe(true)
    expect(dialog).toHaveTextContent('nur für ein Profil gedacht, das noch nie benutzt wurde')
    expect(screen.getByTestId('admin-profil-entfernen-dialog-abbrechen')).toHaveFocus()
    expect(welt.protokoll.entfernt).toHaveLength(0)

    await userEvent.click(screen.getByTestId('admin-profil-entfernen-dialog-bestaetigen'))

    const liste = await screen.findByTestId('liste')
    expect(welt.protokoll.entfernt).toEqual([{ spielerId: 5 }])
    expect(liste).toHaveTextContent('Profil „Beispielspieler 05“ entfernt.')
  })

  test('Regression mutateAsync: die Weiterleitung geschieht, obwohl das Neulesen die Seite aushängt', async () => {
    // Nach dem Entfernen fehlt das Profil in der Liste: Der Lader zeigt „nicht gefunden“, das Formular wird ausgehängt.
    const welt = rendern('/admin/profile/5', bereitstellen())
    await userEvent.click(await screen.findByTestId('admin-profil-entfernen'))

    await userEvent.click(screen.getByTestId('admin-profil-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('liste')).toHaveTextContent('entfernt')
    expect(welt.profile.some((p) => p.spielerId === 5)).toBe(false)
  })

  test('409 PROFIL_IN_VERWENDUNG: Dialog schliesst, Hinweis und „Stattdessen sperren“', async () => {
    const welt = adminWelt()
    welt.inVerwendung.add(1)
    rendern('/admin/profile/1', bereitstellen(welt))
    await userEvent.click(await screen.findByTestId('admin-profil-entfernen'))

    await userEvent.click(screen.getByTestId('admin-profil-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-profil-in-verwendung')).toHaveTextContent(
      'Das Profil hat bereits Daten (Rückmeldungen, Teams, Ergebnisse) und lässt sich nicht entfernen.',
    )
    expect((screen.getByTestId('admin-profil-entfernen-dialog') as HTMLDialogElement).open).toBe(false)

    await userEvent.click(screen.getByTestId('admin-profil-stattdessen-sperren'))

    await waitFor(() => expect(welt.protokoll.blockiert).toEqual([{ spielerId: 1, blockieren: true }]))
  })

  test('ein anderer Fehler beim Entfernen steht im Dialog, der offen bleibt', async () => {
    const welt = bereitstellen()
    mockServer.use(
      http.post('*/admin/user/entfernen', () => problem(500, 'INTERNER_FEHLER', 'Es ist ein interner Fehler aufgetreten.')),
    )
    rendern('/admin/profile/5', welt)
    await userEvent.click(await screen.findByTestId('admin-profil-entfernen'))

    await userEvent.click(screen.getByTestId('admin-profil-entfernen-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-profil-entfernen-dialog-fehler')).toHaveTextContent('interner Fehler')
    expect((screen.getByTestId('admin-profil-entfernen-dialog') as HTMLDialogElement).open).toBe(true)
  })

  test('Abbrechen des Entfernens ändert nichts', async () => {
    const welt = rendern('/admin/profile/5', bereitstellen())
    await userEvent.click(await screen.findByTestId('admin-profil-entfernen'))

    await userEvent.click(screen.getByTestId('admin-profil-entfernen-dialog-abbrechen'))

    expect((screen.getByTestId('admin-profil-entfernen-dialog') as HTMLDialogElement).open).toBe(false)
    expect(welt.protokoll.entfernt).toHaveLength(0)
  })
})
