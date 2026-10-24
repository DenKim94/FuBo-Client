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

  test('der Zähler nennt die Grenzen aus der Konfiguration; außerhalb sperrt „Teams berechnen“ mit Grund (aria-disabled)', async () => {
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
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    expect(screen.getByTestId('admin-teams-grund')).toHaveTextContent('Es sind höchstens 4 Teilnehmer erlaubt.')

    fireEvent.click(knopf)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(welt.protokoll.teamsManuell).toEqual([])
  })

  test('innerhalb der Grenzen ist „Teams berechnen“ frei und der Grund weg', async () => {
    rendern()
    await bereit()

    await waehlen(1, 3)

    expect(screen.getByTestId('admin-teams-berechnen')).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByTestId('admin-teams-grund')).not.toBeInTheDocument()
  })
})

describe('AdminTeams – Gäste', () => {
  test('„Gast hinzufügen“ legt eine Zeile mit Namensfeld (Fokus) und Stufe Mittel an; der Hinweis steht einmal', async () => {
    rendern()
    await bereit()

    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))

    expect(screen.getByTestId('admin-teams-gast-1')).toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-gast-2')).toBeInTheDocument()
    expect(screen.getAllByTestId('admin-teams-gast-hinweis')).toHaveLength(1)
    expect(screen.getByTestId('admin-teams-gast-hinweis')).toHaveTextContent('Ohne Namen heißt der Gast Gast 1, Gast 2')
    expect(screen.getByTestId('admin-teams-gast-stufe-1-MITTEL')).toBeChecked()
    expect(screen.getByTestId('admin-teams-gast-stufe-2-MITTEL')).toBeChecked()
    expect(screen.getByTestId('admin-teams-gast-name-2')).toHaveFocus()
  })

  test('„Entfernen“ nimmt die Zeile weg; der Fokus geht auf „Gast hinzufügen“', async () => {
    rendern()
    await bereit()
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))

    await userEvent.click(screen.getByTestId('admin-teams-gast-entfernen-1'))

    expect(screen.queryByTestId('admin-teams-gast-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-teams-gast-hinweis')).not.toBeInTheDocument()
    expect(screen.getByTestId('admin-teams-gast-hinzufuegen')).toHaveFocus()
  })

  test('der Gastname wird getrimmt gesendet, die Stufe mit; ein leerer Name entfällt; fehlende Profilliste entfällt', async () => {
    const welt = rendern()
    await bereit()
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    await userEvent.type(screen.getByTestId('admin-teams-gast-name-1'), '  Beispielgast  ')
    await userEvent.click(screen.getByTestId('admin-teams-gast-stufe-1-STARK'))
    await userEvent.type(screen.getByTestId('admin-teams-gast-name-2'), '   ')

    await berechnen()

    expect(welt.protokoll.teamsManuell).toEqual([{ gaeste: [{ stufe: 'STARK', name: 'Beispielgast' }, { stufe: 'MITTEL' }] }])
    // Der Server nennt den namenlosen Gast so, wie der Hinweis es sagt.
    expect(screen.getByTestId('admin-teams-ergebnis')).toHaveTextContent('Gast 2 (Gast)')
  })
})

describe('AdminTeams – Ergebnis', () => {
  test('Ergebnis: Überschrift mit Fokus, Hinweis erneut, Teamlisten, Verfahren, Regel und Ungleichgewicht; ohne Skillwerte', async () => {
    const welt = rendern()
    await bereit()
    // Drei Teilnehmer: ungerade, also genau ein Auswechselspieler.
    await waehlen(1, 3)
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))

    const ergebnis = await berechnen()

    expect(welt.protokoll.teamsManuell).toEqual([{ spielerIds: [1, 3], gaeste: [{ stufe: 'MITTEL' }] }])
    const titel = within(ergebnis).getByRole('heading', { level: 2, name: 'Ergebnis' })
    await waitFor(() => expect(titel).toHaveFocus())
    expect(within(ergebnis).getByTestId('teams-manuell-hinweis-ergebnis')).toHaveTextContent('wird nicht gespeichert')
    expect(within(ergebnis).getByTestId('admin-teams-ergebnis-teams-a')).toHaveTextContent('Beispielspieler 01')
    expect(within(ergebnis).getByTestId('admin-teams-ergebnis-teams-b')).toHaveTextContent('Gast 1 (Gast)')
    expect(within(ergebnis).getByTestId('admin-teams-ergebnis-teams-auswechselspieler')).toBeInTheDocument()
    expect(within(ergebnis).getByTestId('admin-teams-verfahren')).toHaveTextContent('Gerechnet mit: Exakt.')
    expect(within(ergebnis).getByTestId('admin-teams-regel')).toHaveTextContent('Auswechselspieler nach der Regel: Schwächster Spieler des größeren Teams.')
    expect(within(ergebnis).getByTestId('admin-teams-ungleichgewicht')).toHaveTextContent('Ungleichgewicht: 1,25')
    expect(within(ergebnis).getByText(/0 heißt vollständig ausgeglichen/)).toBeInTheDocument()
    // Nur diese eine Zahl; keine Skillwerte und keine Stufen der Gäste in den Listen.
    expect(within(ergebnis).queryByText(/Angriff|Verteidigung|Torwart|Laufstärke|Spielstärke/i)).not.toBeInTheDocument()
    expect(within(screen.getByTestId('admin-teams-ergebnis-teams-b')).queryByText(/Stark|Mittel|Schwach/)).not.toBeInTheDocument()
  })

  test.each<[string, () => Promise<unknown>]>([
    ['ein Profil dazuwählen', () => userEvent.click(screen.getByTestId('admin-teams-profil-5'))],
    ['ein Profil abwählen', () => userEvent.click(screen.getByTestId('admin-teams-profil-1'))],
    ['einen Gast hinzufügen', () => userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))],
    ['die Stufe eines Gastes ändern', () => userEvent.click(screen.getByTestId('admin-teams-gast-stufe-1-SCHWACH'))],
    ['den Namen eines Gastes ändern', () => userEvent.type(screen.getByTestId('admin-teams-gast-name-1'), 'X')],
    ['einen Gast entfernen', () => userEvent.click(screen.getByTestId('admin-teams-gast-entfernen-1'))],
    ['„Alle auswählen“', () => userEvent.click(screen.getByTestId('admin-teams-alle'))],
    ['„Keine“', () => userEvent.click(screen.getByTestId('admin-teams-keine'))],
  ])('M12 – %s lässt das Ergebnis verschwinden', async (_name, aendern) => {
    rendern()
    await bereit()
    await waehlen(1, 3)
    await userEvent.click(screen.getByTestId('admin-teams-gast-hinzufuegen'))
    await berechnen()

    await aendern()

    await waitFor(() => expect(screen.queryByTestId('admin-teams-ergebnis')).not.toBeInTheDocument())
  })

  test('„Erneut berechnen“ ist derselbe Aufruf mit derselben Auswahl', async () => {
    const welt = rendern()
    await bereit()
    await waehlen(1, 3)
    await berechnen()

    await userEvent.click(screen.getByTestId('admin-teams-erneut'))

    await waitFor(() => expect(welt.protokoll.teamsManuell).toHaveLength(2))
    expect(welt.protokoll.teamsManuell[1]).toEqual(welt.protokoll.teamsManuell[0])
    expect(await screen.findByTestId('admin-teams-ergebnis')).toBeInTheDocument()
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

    expect(screen.getByTestId('admin-teams-verfahren')).toHaveTextContent('Gerechnet mit: Schnell.')
    expect(screen.getByTestId('admin-teams-verfahren-abweichung')).toHaveTextContent('Abweichend von der Einstellung')
    expect(screen.getByTestId('admin-teams-regel')).toHaveTextContent('Schwächster Spieler des größeren Teams')
    expect(screen.getByTestId('admin-teams-regel-abweichung')).toHaveTextContent('keine Anmeldereihenfolge')
    expect(screen.getByTestId('admin-teams-ungleichgewicht')).toHaveTextContent('Ungleichgewicht: 0')
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
