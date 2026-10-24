import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { adminHandler, adminWelt, beispielKonfiguration, type AdminWelt } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminTeams from './AdminTeams'

afterEach(() => {
  queryClient.clear()
})

type Konfig = Parameters<typeof beispielKonfiguration>[0]

/**
 * Die Beispielwelt hat die wählbaren Profile 1, 3 und 5, das Profil 4 mit unvollständiger Skillkarte, das gesperrte Profil 2
 * und das Adminprofil 99. Mit Mindestzahl 2 und Höchstzahl 4 sind die Grenzen im Test schnell erreicht.
 */
function rendern(konfiguration: Konfig = { minTeilnehmer: 2, maxTeilnehmer: 4 }): AdminWelt {
  const welt = adminWelt({ konfiguration: beispielKonfiguration(konfiguration) })
  mockServer.use(...adminHandler(welt))
  render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={['/admin/teams']}>
        <Routes>
          <Route path="/admin/teams" element={<AdminTeams />} />
          <Route path="/admin/profile" element={<p data-testid="seite-profile">Profile</p>} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

async function bereit() {
  await screen.findByTestId('admin-teams-profil-1')
  // Zähler mit Grenzen heißt: auch die Konfiguration ist gelesen.
  await waitFor(() => expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Erlaubt:'))
}

async function waehlen(...ids: number[]) {
  for (const id of ids) await userEvent.click(screen.getByTestId(`admin-teams-profil-${String(id)}`))
}

/** Legt einen Gast an und übernimmt ihn (Eingabe öffnen, Name und Stufe setzen, „Übernehmen“). */
async function gastAnlegen(name = '', stufe?: 'STARK' | 'MITTEL' | 'SCHWACH') {
  await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
  if (name !== '') await userEvent.type(screen.getByTestId('admin-teams-gast-name'), name)
  if (stufe) await userEvent.click(screen.getByTestId(`admin-teams-gast-stufe-${stufe}`))
  await userEvent.click(screen.getByTestId('admin-teams-gast-uebernehmen'))
}

async function berechnen() {
  await userEvent.click(screen.getByTestId('admin-teams-berechnen'))
  return screen.findByTestId('admin-teams-ergebnis')
}

describe('AdminTeams – Auswahl', () => {
  test('zeigt den dauerhaften Hinweis oberhalb der Auswahl (E18) und listet nur aktive Spieler', async () => {
    rendern()
    await bereit()

    expect(screen.getByRole('heading', { level: 1, name: 'Team-Generator' })).toBeInTheDocument()
    const hinweis = screen.getByTestId('teams-manuell-hinweis')
    expect(hinweis).toHaveTextContent('Die Einteilung wird nicht gespeichert')
    expect(hinweis).toHaveTextContent('Sie ist weg, sobald du die Seite verlässt.')
    // Der Hinweis steht vor der Auswahl.
    const gruppe = screen.getByRole('group', { name: 'Spielerprofile' })
    expect(hinweis.compareDocumentPosition(gruppe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    for (const id of [1, 3, 4, 5]) expect(screen.getByTestId(`admin-teams-profil-${String(id)}`)).toBeInTheDocument()
    expect(screen.queryByTestId('admin-teams-profil-2')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-teams-profil-99')).not.toBeInTheDocument()
  })

  test('ein Profil mit unvollständiger Skillkarte ist sichtbar, deaktiviert und nennt den Grund als Text (E7)', async () => {
    rendern()
    await bereit()
    await waitFor(() => expect(screen.getByTestId('admin-teams-profil-4')).toBeDisabled())

    const box = screen.getByTestId('admin-teams-profil-4')
    expect(screen.getByTestId('admin-teams-unvollstaendig-4')).toHaveTextContent('Skillwerte unvollständig')
    expect(box).toHaveAccessibleDescription('Skillwerte unvollständig')
    expect(screen.getByTestId('admin-teams-profil-1')).toBeEnabled()
  })

  test('„Alle auswählen“ wählt alle wählbaren, nie das unvollständige; „Keine“ leert', async () => {
    rendern()
    await bereit()
    await waitFor(() => expect(screen.getByTestId('admin-teams-profil-4')).toBeDisabled())

    await userEvent.click(screen.getByTestId('admin-teams-alle'))

    expect(screen.getByTestId('admin-teams-profil-1')).toBeChecked()
    expect(screen.getByTestId('admin-teams-profil-3')).toBeChecked()
    expect(screen.getByTestId('admin-teams-profil-5')).toBeChecked()
    expect(screen.getByTestId('admin-teams-profil-4')).not.toBeChecked()
    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 3.')

    await userEvent.click(screen.getByTestId('admin-teams-keine'))

    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 0.')
  })

  test('der Zähler nennt die Grenzen aus der Konfiguration; außerhalb sperrt „Teams einteilen“ mit Grund (aria-disabled)', async () => {
    const welt = rendern()
    await bereit()
    const knopf = screen.getByTestId('admin-teams-berechnen')

    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 0. Erlaubt: 2 bis 4.')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('admin-teams-grund')).toHaveTextContent('Bitte wähle Spieler oder füge Gäste hinzu.')
    expect(knopf).toHaveAccessibleDescription('Bitte wähle Spieler oder füge Gäste hinzu.')

    await waehlen(1)
    expect(screen.getByTestId('admin-teams-grund')).toHaveTextContent('Es braucht mindestens 2 Teilnehmer.')

    await waehlen(3, 5)
    await gastAnlegen()
    await gastAnlegen()
    expect(screen.getByTestId('admin-teams-grund')).toHaveTextContent('Es sind höchstens 4 Teilnehmer erlaubt.')

    fireEvent.click(knopf)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(welt.protokoll.teamsManuell).toEqual([])
  })

  test('innerhalb der Grenzen ist „Teams einteilen“ frei und der Grund weg', async () => {
    rendern()
    await bereit()

    await waehlen(1, 3)

    expect(screen.getByTestId('admin-teams-berechnen')).not.toHaveAttribute('aria-disabled')
    expect(screen.getByTestId('admin-teams-berechnen')).toHaveTextContent('Teams einteilen')
    expect(screen.queryByTestId('admin-teams-grund')).not.toBeInTheDocument()
  })
})

describe('AdminTeams – Gäste (Eingabe mit „Übernehmen“ und „Abbrechen“, 24.10.2026)', () => {
  test('„Gast hinzufügen“ öffnet die Eingabe: Fokus im Namensfeld, Stufe Mittel, Hinweis; gezählt wird noch nichts', async () => {
    rendern()
    await bereit()

    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))

    expect(screen.getByTestId('admin-teams-gast-eingabe')).toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-gast-name')).toHaveFocus()
    expect(screen.getByTestId('admin-teams-gast-stufe-MITTEL')).toBeChecked()
    expect(screen.getByTestId('admin-teams-gast-hinweis')).toHaveTextContent('Ohne Namen heißt der Gast z.B. „Gast 1“.')
    expect(screen.getByTestId('admin-teams-gast-abbrechen')).toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-gast-uebernehmen')).toBeInTheDocument()
    // Während der Eingabe gibt es keinen zweiten „Gast hinzufügen“.
    expect(screen.queryByTestId('admin-teams-gast-hinzufuegen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-teams-gast-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 0.')
  })

  test('„Übernehmen“ nimmt den Gast mit Name und Stufe in die Liste, zählt ihn und setzt den Fokus auf „Gast hinzufügen“', async () => {
    rendern()
    await bereit()

    await gastAnlegen('Beispielgast', 'STARK')
    await gastAnlegen()

    expect(screen.queryByTestId('admin-teams-gast-eingabe')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-gast-1')).toHaveTextContent('Beispielgast')
    expect(screen.getByTestId('admin-teams-gast-1')).toHaveTextContent('Stufe: Stark')
    expect(screen.getByTestId('admin-teams-gast-2')).toHaveTextContent('Gast 2')
    expect(screen.getByTestId('admin-teams-gast-2')).toHaveTextContent('Stufe: Mittel')
    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 2.')
    expect(screen.getByTestId('admin-teams-gast-hinzufuegen')).toHaveFocus()
  })

  test('„Abbrechen“ verwirft die Eingabe: kein Gast, kein Zähler, Fokus auf „Gast hinzufügen“', async () => {
    rendern()
    await bereit()
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    await userEvent.type(screen.getByTestId('admin-teams-gast-name'), 'Beispielgast')

    await userEvent.click(screen.getByTestId('admin-teams-gast-abbrechen'))

    expect(screen.queryByTestId('admin-teams-gast-eingabe')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-teams-gast-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 0.')
    expect(screen.getByTestId('admin-teams-gast-hinzufuegen')).toHaveFocus()
  })

  test('solange eine Eingabe offen ist, sperrt „Teams einteilen“ mit Grund und sendet nichts', async () => {
    const welt = rendern()
    await bereit()
    await waehlen(1, 3)
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))

    const knopf = screen.getByTestId('admin-teams-berechnen')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('admin-teams-grund')).toHaveTextContent('Bitte übernimm den Gast oder brich die Eingabe ab.')
    fireEvent.click(knopf)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(welt.protokoll.teamsManuell).toEqual([])
  })

  test('„Entfernen“ nimmt einen übernommenen Gast weg; der Fokus geht auf „Gast hinzufügen“', async () => {
    rendern()
    await bereit()
    await gastAnlegen('Beispielgast')

    await userEvent.click(screen.getByRole('button', { name: 'Entfernen: Beispielgast' }))

    expect(screen.queryByTestId('admin-teams-gast-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 0.')
    expect(screen.getByTestId('admin-teams-gast-hinzufuegen')).toHaveFocus()
  })

  test('der Gastname wird getrimmt gesendet, die Stufe mit; ein leerer Name entfällt; fehlende Profilliste entfällt', async () => {
    const welt = rendern()
    await bereit()
    await gastAnlegen('  Beispielgast  ', 'STARK')
    await gastAnlegen('   ')

    await berechnen()

    expect(welt.protokoll.teamsManuell).toEqual([{ gaeste: [{ stufe: 'STARK', name: 'Beispielgast' }, { stufe: 'MITTEL' }] }])
    // Der Server nennt den namenlosen Gast so, wie die Liste es zeigt.
    expect(screen.getByTestId('admin-teams-ergebnis')).toHaveTextContent('Gast 2 (Gast)')
  })
})

describe('AdminTeams – Ergebnis', () => {
  test('Ergebnis: Überschrift mit Fokus, Hinweis erneut, Teamlisten und Algorithmus; ohne Skillwerte und ohne Ungleichgewicht', async () => {
    const welt = rendern()
    await bereit()
    // Drei Teilnehmer: ungerade, also genau ein Auswechselspieler.
    await waehlen(1, 3)
    await gastAnlegen()

    const ergebnis = await berechnen()

    expect(welt.protokoll.teamsManuell).toEqual([{ spielerIds: [1, 3], gaeste: [{ stufe: 'MITTEL' }] }])
    const titel = within(ergebnis).getByRole('heading', { level: 2, name: 'Ergebnis' })
    await waitFor(() => expect(titel).toHaveFocus())
    expect(within(ergebnis).getByTestId('teams-manuell-hinweis-ergebnis')).toHaveTextContent('wird nicht gespeichert')
    expect(within(ergebnis).getByTestId('admin-teams-ergebnis-teams-a')).toHaveTextContent('Beispielspieler 01')
    expect(within(ergebnis).getByTestId('admin-teams-ergebnis-teams-b')).toHaveTextContent('Gast 1 (Gast)')
    expect(within(ergebnis).getByTestId('admin-teams-ergebnis-teams-auswechselspieler')).toBeInTheDocument()
    expect(within(ergebnis).getByTestId('admin-teams-verfahren')).toHaveTextContent('Algorithmus-Typ: Standard')
    // Seit 24.10.2026 ohne Regel-Zeile und ohne „Ungleichgewicht“ (Entscheidung des Entwicklers).
    expect(within(ergebnis).queryByTestId('admin-teams-regel')).not.toBeInTheDocument()
    expect(within(ergebnis).queryByText(/Ungleichgewicht/)).not.toBeInTheDocument()
    // Keine Skillwerte und keine Stufen der Gäste in den Listen.
    expect(within(ergebnis).queryByText(/Angriff|Verteidigung|Torwart|Laufstärke|Spielstärke/i)).not.toBeInTheDocument()
    expect(within(screen.getByTestId('admin-teams-ergebnis-teams-b')).queryByText(/Stark|Mittel|Schwach/)).not.toBeInTheDocument()
  })

  test.each<[string, () => Promise<unknown>]>([
    ['ein Profil dazuwählen', () => userEvent.click(screen.getByTestId('admin-teams-profil-5'))],
    ['ein Profil abwählen', () => userEvent.click(screen.getByTestId('admin-teams-profil-1'))],
    ['einen Gast übernehmen', () => gastAnlegen('Beispielgast')],
    ['einen Gast entfernen', () => userEvent.click(screen.getByTestId('admin-teams-gast-entfernen-1'))],
    ['„Alle auswählen“', () => userEvent.click(screen.getByTestId('admin-teams-alle'))],
    ['„Keine“', () => userEvent.click(screen.getByTestId('admin-teams-keine'))],
  ])('M12 – %s lässt das Ergebnis verschwinden', async (_name, aendern) => {
    rendern()
    await bereit()
    await waehlen(1, 3)
    await gastAnlegen()
    await berechnen()

    await aendern()

    await waitFor(() => expect(screen.queryByTestId('admin-teams-ergebnis')).not.toBeInTheDocument())
  })

  test('eine Eingabe öffnen und abbrechen ändert die Auswahl nicht: Das Ergebnis bleibt', async () => {
    rendern()
    await bereit()
    await waehlen(1, 3)
    await berechnen()

    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    await userEvent.click(screen.getByTestId('admin-teams-gast-abbrechen'))

    expect(screen.getByTestId('admin-teams-ergebnis')).toBeInTheDocument()
  })

  test('ein zweiter Lauf geht über „Teams einteilen“ mit derselben Auswahl (kein eigener „Erneut berechnen“)', async () => {
    const welt = rendern()
    await bereit()
    await waehlen(1, 3)
    await berechnen()
    expect(screen.queryByTestId('admin-teams-erneut')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('admin-teams-berechnen'))

    await waitFor(() => expect(welt.protokoll.teamsManuell).toHaveLength(2))
    expect(welt.protokoll.teamsManuell[1]).toEqual(welt.protokoll.teamsManuell[0])
  })

  test('Verfahren und Regel stehen so da, wie der Server sie meldet; Abweichungen von der Konfiguration werden erklärt', async () => {
    rendern({ minTeilnehmer: 2, maxTeilnehmer: 4, algorithmType: 'EXHAUSTIV', auswechselModus: 'ZULETZT_ANGEMELDET' })
    mockServer.use(
      http.post('*/admin/teams/generieren', () =>
        HttpResponse.json({
          algorithmType: 'HEURISTIK',
          auswechselModus: 'SCHWAECHSTER_UEBERZAHL',
          auswechselspieler: null,
          differenzTeamstaerke: 0,
          teamA: [{ anzeigeName: 'Beispielspieler 01', gast: false, auswechselspieler: false }],
          teamB: [{ anzeigeName: 'Beispielspieler 03', gast: false, auswechselspieler: false }],
        }),
      ),
    )
    await bereit()
    await waehlen(1, 3)

    await berechnen()

    expect(screen.getByTestId('admin-teams-verfahren')).toHaveTextContent('Algorithmus-Typ: Schnell')
    expect(screen.getByTestId('admin-teams-verfahren-abweichung')).toHaveTextContent('Abweichend von der Einstellung')
    expect(screen.getByTestId('admin-teams-regel-abweichung')).toHaveTextContent('keine Anmeldereihenfolge')
  })

  test('ohne Abweichung steht kein Erklärsatz da', async () => {
    rendern()
    await bereit()
    await waehlen(1, 3)

    await berechnen()

    expect(screen.queryByTestId('admin-teams-verfahren-abweichung')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-teams-regel-abweichung')).not.toBeInTheDocument()
  })

  test('das Ergebnis liegt nirgends im Cache (E18)', async () => {
    rendern()
    await bereit()
    await waehlen(1, 3)
    await berechnen()

    const schluesselListe = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => JSON.stringify(q.queryKey))
      .join(' ')
    expect(schluesselListe).not.toMatch(/teams/i)
  })
})

describe('AdminTeams – Fehler des Servers', () => {
  test.each([
    ['ZU_WENIG_TEILNEHMER', 'Es braucht mindestens 6 Teilnehmer, ausgewählt sind 2.'],
    ['ZU_VIELE_TEILNEHMER', 'Es sind höchstens 1 Teilnehmer erlaubt, ausgewählt sind 2.'],
  ] as const)('%s: der Text des Servers steht da, die Auswahl bleibt, es gibt kein Ergebnis', async (code, detail) => {
    rendern()
    mockServer.use(http.post('*/admin/teams/generieren', () => problem(409, code, detail)))
    await bereit()
    await waehlen(1, 3)

    await userEvent.click(screen.getByTestId('admin-teams-berechnen'))

    expect(await screen.findByTestId('admin-teams-fehler')).toHaveTextContent(detail)
    expect(screen.queryByTestId('admin-teams-ergebnis')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-profil-1')).toBeChecked()
    expect(screen.queryByTestId('admin-teams-zu-profilen')).not.toBeInTheDocument()
  })

  test('SKILLWERTE_UNVOLLSTAENDIG nennt die Namen und verlinkt auf die Profile', async () => {
    rendern()
    mockServer.use(
      http.post('*/admin/teams/generieren', () =>
        problem(409, 'SKILLWERTE_UNVOLLSTAENDIG', 'Die Skillwerte von Beispielspieler 03 sind unvollständig.'),
      ),
    )
    await bereit()
    await waehlen(1, 3)

    await userEvent.click(screen.getByTestId('admin-teams-berechnen'))

    expect(await screen.findByTestId('admin-teams-fehler')).toHaveTextContent('Beispielspieler 03')
    await userEvent.click(screen.getByTestId('admin-teams-zu-profilen'))
    expect(await screen.findByTestId('seite-profile')).toBeInTheDocument()
  })

  test('PROFIL_GESCHUETZT und 400 lesen die Profile neu, weil die Auswahl nicht mehr stimmt', async () => {
    const welt = rendern()
    mockServer.use(http.post('*/admin/teams/generieren', () => problem(409, 'PROFIL_GESCHUETZT', 'Das Adminprofil kann nicht eingeteilt werden.')))
    await bereit()
    await waehlen(1, 3)
    const vorher = welt.protokoll.profilAbrufe.length

    await userEvent.click(screen.getByTestId('admin-teams-berechnen'))

    expect(await screen.findByTestId('admin-teams-fehler')).toHaveTextContent('Adminprofil')
    await waitFor(() => expect(welt.protokoll.profilAbrufe.length).toBeGreaterThan(vorher))
  })

  test('ein inzwischen gesperrtes Profil fällt aus der Auswahl, ohne dass es noch mitgesendet wird', async () => {
    const welt = rendern()
    await bereit()
    await waehlen(1, 3)
    // Profil 3 wird gesperrt; die Seite liest neu (hier über einen Fehlerfall der ersten Berechnung).
    welt.fremdeProfilAenderung(3, { aktiv: false })
    mockServer.use(http.post('*/admin/teams/generieren', () => problem(400, 'EINGABE_UNGUELTIG', 'Das Profil 3 ist unbekannt oder gesperrt.')))
    await userEvent.click(screen.getByTestId('admin-teams-berechnen'))
    await screen.findByTestId('admin-teams-fehler')

    await waitFor(() => expect(screen.queryByTestId('admin-teams-profil-3')).not.toBeInTheDocument())
    expect(screen.getByTestId('admin-teams-zaehler')).toHaveTextContent('Ausgewählt: 1.')
  })
})
