import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { adminHandler, adminWelt, beispielKonfiguration, STANDARD_ABSAGEVORLAGE } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminKonfiguration from './AdminKonfiguration'

afterEach(() => {
  queryClient.clear()
})

function rendern(konfiguration = beispielKonfiguration()) {
  const welt = adminWelt({ konfiguration })
  mockServer.use(...adminHandler(welt))
  render(
    <QueryUmgebung>
      <MemoryRouter>
        <AdminKonfiguration />
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

function eintragen(feld: string, wert: string) {
  fireEvent.change(screen.getByTestId(`admin-konfig-${feld}`), { target: { value: wert } })
}

async function speichern() {
  fireEvent.click(await screen.findByTestId('admin-konfig-speichern'))
}

describe('AdminKonfiguration – Lesen', () => {
  test('belegt das Formular mit dem Stand des Servers, ohne Kopf X-FuBo-Kein-Refresh', async () => {
    const welt = rendern()

    expect(await screen.findByRole('heading', { level: 1, name: 'Konfiguration' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-konfig-minTeilnehmer')).toHaveValue('6')
    expect(screen.getByTestId('admin-konfig-maxTeilnehmer')).toHaveValue('22')
    expect(screen.getByTestId('admin-konfig-anzGuests')).toHaveValue('4')
    expect(screen.getByTestId('admin-konfig-sessionLeerlaufMinuten')).toHaveValue('15')
    expect(screen.getByTestId('admin-konfig-hallenModusAktiv')).not.toBeChecked()
    expect(screen.getByTestId('admin-konfig-pushAktiv')).toBeChecked()
    expect(screen.getByTestId('admin-konfig-halleEmail')).toHaveValue('')
    expect(welt.protokoll.konfigurationAbrufe).toEqual([null])
  })

  test('zeigt den wirksamen Text der Absage, wenn die Vorlage leer ist', async () => {
    rendern()

    expect(await screen.findByTestId('admin-konfig-vorlage-effektiv-text')).toHaveTextContent(STANDARD_ABSAGEVORLAGE)
  })

  test('ein Fehler beim Laden zeigt einen Fehlerzustand; „Erneut versuchen“ lädt neu und zeigt das Formular', async () => {
    const welt = adminWelt()
    let ausfall = true
    // Der Übersteuerer steht vorn: MSW nimmt den ersten passenden Handler.
    mockServer.use(
      http.get('*/admin/config/lesen', () => (ausfall ? problem(500, 'INTERNER_FEHLER', 'Interner Fehler.') : undefined)),
      ...adminHandler(welt),
    )
    render(
      <QueryUmgebung>
        <MemoryRouter>
          <AdminKonfiguration />
        </MemoryRouter>
      </QueryUmgebung>,
    )

    // Bei einem Serverfehler wiederholt der Client einmal, bevor er aufgibt.
    const erneut = await screen.findByTestId('admin-konfig-laden-fehler-erneut', {}, { timeout: 4000 })
    expect(screen.queryByTestId('admin-konfiguration')).not.toBeInTheDocument()
    ausfall = false
    fireEvent.click(erneut)

    expect(await screen.findByTestId('admin-konfiguration')).toBeInTheDocument()
  })
})

describe('AdminKonfiguration – Speichern', () => {
  test('ohne Änderung ist „Speichern“ aria-disabled mit Grund und sendet nichts', async () => {
    const welt = rendern()

    const knopf = await screen.findByTestId('admin-konfig-speichern')
    expect(knopf).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('admin-konfig-grund')).toHaveTextContent('Es gibt keine Änderung.')
    fireEvent.click(knopf)

    expect(welt.protokoll.konfigurationGeaendert).toEqual([])
  })

  test('sendet ein Voll-Update mit allen fünfzehn Schlüsseln und der version des gelesenen Standes', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-anzGuests')

    eintragen('anzGuests', '6')
    await speichern()

    await waitFor(() => {
      expect(welt.protokoll.konfigurationGeaendert).toHaveLength(1)
    })
    const rumpf = welt.protokoll.konfigurationGeaendert[0] as Record<string, unknown>
    expect(Object.keys(rumpf)).toHaveLength(15)
    expect(rumpf).toMatchObject({ version: 1, anzGuests: 6, minTeilnehmer: 6, maxTeilnehmer: 22, halleEmail: null, halleAbsageVorlage: null })
    expect(rumpf).not.toHaveProperty('halleAbsageVorlageEffektiv')
    expect(rumpf).not.toHaveProperty('geaendertAm')
  })

  test('nach dem Speichern zeigt das Formular „Gespeichert.“ mit dem neuen Stand (neue version) und der Fokus liegt auf „Speichern“', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-anzGuests')

    eintragen('anzGuests', '6')
    await speichern()

    expect(await screen.findByTestId('admin-konfig-gespeichert')).toHaveTextContent('Gespeichert.')
    expect(welt.konfiguration.version).toBe(2)
    expect(screen.getByTestId('admin-konfig-anzGuests')).toHaveValue('6')
    expect(screen.getByTestId('admin-konfig-speichern')).toHaveAttribute('aria-disabled', 'true')
    await waitFor(() => {
      expect(screen.getByTestId('admin-konfig-speichern')).toHaveFocus()
    })
  })

  test('eine geleerte Adresse und Vorlage gehen als null hinaus', async () => {
    const welt = rendern(beispielKonfiguration({ halleEmail: 'halle@beispiel.example', halleAbsageVorlage: 'Text' }))
    await screen.findByTestId('admin-konfig-halleEmail')

    eintragen('halleEmail', '')
    eintragen('halleAbsageVorlage', '')
    await speichern()

    await waitFor(() => {
      expect(welt.protokoll.konfigurationGeaendert).toHaveLength(1)
    })
    expect(welt.protokoll.konfigurationGeaendert[0]).toMatchObject({ halleEmail: null, halleAbsageVorlage: null })
  })

  test('die Auswahl des Verfahrens geht als Wert des Vertrags hinaus', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-algorithmType')

    fireEvent.click(screen.getByTestId('admin-konfig-algorithmType'))
    fireEvent.click(screen.getByTestId('admin-konfig-algorithmType-option-HEURISTIK'))
    await speichern()

    await waitFor(() => {
      expect(welt.protokoll.konfigurationGeaendert).toHaveLength(1)
    })
    expect(welt.protokoll.konfigurationGeaendert[0]).toMatchObject({ algorithmType: 'HEURISTIK' })
  })
})

describe('AdminKonfiguration – Prüfung', () => {
  test('ein ungültiger Wert wird nicht gesendet, der Fokus geht auf das erste fehlerhafte Feld', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-anzGuests')

    eintragen('halleVorlaufStunden', '-1')
    eintragen('anzGuests', '99')
    await speichern()

    expect(await screen.findByTestId('admin-konfig-anzGuests-fehler')).toHaveTextContent('von 0 bis 22')
    expect(screen.getByTestId('admin-konfig-halleVorlaufStunden-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('admin-konfig-anzGuests')).toHaveFocus()
    expect(welt.protokoll.konfigurationGeaendert).toEqual([])
  })

  test('beim Verlassen eines Feldes erscheint der Fehler, vorher nicht', async () => {
    rendern()
    await screen.findByTestId('admin-konfig-anzGuests')

    eintragen('anzGuests', '99')
    expect(screen.queryByTestId('admin-konfig-anzGuests-fehler')).not.toBeInTheDocument()
    fireEvent.blur(screen.getByTestId('admin-konfig-anzGuests'))

    expect(await screen.findByTestId('admin-konfig-anzGuests-fehler')).toBeInTheDocument()
  })

  test('die Höchstzahl unter der Mindestzahl wird an der Höchstzahl gemeldet', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-minTeilnehmer')

    eintragen('minTeilnehmer', '10')
    eintragen('maxTeilnehmer', '9')
    await speichern()

    expect(await screen.findByTestId('admin-konfig-maxTeilnehmer-fehler')).toHaveTextContent('nicht unter der Mindestzahl')
    expect(welt.protokoll.konfigurationGeaendert).toEqual([])
  })

  test('unter fünf Minuten Leerlauf warnt die Maske, sperrt aber nicht', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-sessionLeerlaufMinuten')

    eintragen('sessionLeerlaufMinuten', '3')
    expect(await screen.findByTestId('admin-konfig-leerlauf-warnung')).toBeInTheDocument()
    await speichern()

    await waitFor(() => {
      expect(welt.protokoll.konfigurationGeaendert).toHaveLength(1)
    })
    expect(welt.protokoll.konfigurationGeaendert[0]).toMatchObject({ sessionLeerlaufMinuten: 3 })
  })

  test('ab fünf Minuten erscheint keine Warnung', async () => {
    rendern()
    await screen.findByTestId('admin-konfig-sessionLeerlaufMinuten')

    eintragen('sessionLeerlaufMinuten', '5')

    expect(screen.queryByTestId('admin-konfig-leerlauf-warnung')).not.toBeInTheDocument()
  })
})

describe('AdminKonfiguration – E5: DATEN_VERALTET', () => {
  test('zeigt den Hinweis und den frischen Stand; die alten Eingaben werden nie mit neuer version gesendet', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-anzGuests')

    eintragen('anzGuests', '6')
    welt.fremdeKonfigurationAenderung({ pushErinnerungStunden: 12 })
    await speichern()

    expect(await screen.findByTestId('admin-konfig-veraltet')).toHaveTextContent('zwischenzeitlich geändert')
    // Frischer Stand: die fremde Änderung ist da, die eigene Eingabe weg.
    await waitFor(() => {
      expect(screen.getByTestId('admin-konfig-pushErinnerungStunden')).toHaveValue('12')
    })
    expect(screen.getByTestId('admin-konfig-anzGuests')).toHaveValue('4')
    // Genau ein Schreibversuch (kein stilles Wiederholen), und nichts mit der neuen version.
    expect(welt.protokoll.konfigurationGeaendert).toHaveLength(1)
    expect(welt.konfiguration.anzGuests).toBe(4)
  })

  test('der Hinweis verschwindet mit der nächsten Eingabe', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-konfig-anzGuests')
    eintragen('anzGuests', '6')
    welt.fremdeKonfigurationAenderung()
    await speichern()
    await screen.findByTestId('admin-konfig-veraltet')

    eintragen('anzGuests', '5')

    // Das Zurücksetzen der Mutation erreicht die Anzeige im nächsten Takt.
    await waitFor(() => {
      expect(screen.queryByTestId('admin-konfig-veraltet')).not.toBeInTheDocument()
    })
  })
})
