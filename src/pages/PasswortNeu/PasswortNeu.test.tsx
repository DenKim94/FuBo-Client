import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TEXT_NICHT_ERREICHBAR } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import PasswortNeu, { HINWEIS_PASSWORT_GESETZT } from './PasswortNeu'

const MINUTE = 60_000

/** Zeigt den Navigationszustand der Zielansicht als Text. */
function Ziel() {
  const ort = useLocation()
  return <p data-testid="ziel">{JSON.stringify({ pfad: ort.pathname, state: ort.state })}</p>
}

/** Rendert die Ansicht in einem Router mit den Zielen Admin-Anmeldung und Schritt 1. */
function rendern(state?: unknown) {
  return render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[{ pathname: '/admin/passwort/neu', state }]}>
        <Routes>
          <Route path="/admin/passwort/neu" element={<PasswortNeu />} />
          <Route path="/admin/anmelden" element={<Ziel />} />
          <Route path="/admin/passwort/vergessen" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
}

/** Füllt PIN und Passwort. */
function ausfuellen(pin = '12345', passwort = 'beispiel-passwort-02') {
  fireEvent.change(screen.getByTestId('reset-pin-feld'), { target: { value: pin } })
  fireEvent.change(screen.getByTestId('passwort-neu-passwort'), { target: { value: passwort } })
}

/** Speichert das Passwort. */
function speichern() {
  fireEvent.click(screen.getByTestId('passwort-neu-absenden'))
}

/** Antwort `400 EINGABE_UNGUELTIG` mit Feldmeldungen. */
function eingabeUngueltig(felder: Record<string, string>) {
  return HttpResponse.json(
    {
      type: 'about:blank',
      status: 400,
      code: 'EINGABE_UNGUELTIG',
      detail: 'Die Eingabe ist ungültig.',
      felder,
    },
    { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('PasswortNeu', () => {
  describe('Aufbau', () => {
    test('zeigt Schritt 2 mit PIN-Feld aus fünf Kästchen und Passwortfeld', () => {
      rendern()

      expect(screen.getByTestId('passwort-neu-schritt')).toHaveTextContent('Schritt 2 von 2')
      expect(screen.getAllByTestId('reset-pin-kasten')).toHaveLength(5)
      const pin = screen.getByLabelText('Bestätigungs-PIN')
      expect(pin).toHaveFocus()
      expect(pin).toHaveAttribute('autocomplete', 'one-time-code')
      expect(pin).toHaveAttribute('maxlength', '5')
      expect(pin).toHaveAccessibleDescription(
        'Höchstens fünf Versuche, danach muss eine neue PIN angefordert werden.',
      )
      expect(screen.getByLabelText('Neues Passwort')).toHaveAttribute('autocomplete', 'new-password')
      expect(screen.getByTestId('passwort-neu-regeln')).toBeInTheDocument()
    })

    test('verknüpft die Regelliste mit dem Passwortfeld', () => {
      rendern()
      expect(screen.getByLabelText('Neues Passwort')).toHaveAccessibleDescription(/mindestens 10 Zeichen/)
    })

    test('sperrt „Passwort speichern", bis PIN vollständig und Passwort lang genug sind', () => {
      rendern()
      const knopf = screen.getByTestId('passwort-neu-absenden')
      expect(knopf).toBeDisabled()

      ausfuellen('1234', 'beispiel-passwort-02')
      expect(knopf).toBeDisabled()

      ausfuellen('12345', 'zu-kurz')
      expect(knopf).toBeDisabled()

      ausfuellen('12345', 'beispiel-passwort-02')
      expect(knopf).toBeEnabled()
    })
  })

  describe('Restgültigkeit', () => {
    test('zeigt mit Zeitpunkt der Anforderung Balken und festen Satz mit Uhrzeit', () => {
      const angefordertUm = Date.now()
      rendern({ angefordertUm })

      const erwartet = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(
        angefordertUm + 15 * MINUTE,
      )
      expect(screen.getByTestId('passwort-neu-gueltigkeit')).toHaveTextContent(
        `Gültig bis ${erwartet} Uhr.`,
      )
      expect(screen.getByTestId('passwort-neu-balken')).toHaveAttribute('aria-hidden', 'true')
    })

    test('zeigt ohne Zeitpunkt keinen Balken, sondern den allgemeinen Satz', () => {
      rendern()

      expect(screen.getByTestId('passwort-neu-gueltigkeit')).toHaveTextContent(
        'Die PIN ist 15 Minuten ab Anforderung gültig.',
      )
      expect(screen.queryByTestId('passwort-neu-balken')).not.toBeInTheDocument()
    })

    test('ignoriert einen unbrauchbaren Zeitpunkt im Zustand', () => {
      rendern({ angefordertUm: 'gestern' })
      expect(screen.queryByTestId('passwort-neu-balken')).not.toBeInTheDocument()
    })
  })

  describe('Erfolg', () => {
    test('204: schickt PIN und Passwort ab und geht mit Hinweis zur Admin-Anmeldung', async () => {
      let gesendet: unknown
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', async ({ request }) => {
          gesendet = await request.json()
          return new HttpResponse(null, { status: 204 })
        }),
      )
      rendern()
      ausfuellen('12345', ' beispiel passwort ')

      speichern()

      const ziel = JSON.parse((await screen.findByTestId('ziel')).textContent ?? '{}') as {
        pfad: string
        state: { hinweis: string }
      }
      // Kein Trimmen: Leerzeichen gehören zum Passwort.
      expect(gesendet).toEqual({ bestaetigungsPin: '12345', neuesPasswort: ' beispiel passwort ' })
      expect(ziel.pfad).toBe('/admin/anmelden')
      expect(ziel.state.hinweis).toBe(HINWEIS_PASSWORT_GESETZT)
      expect(HINWEIS_PASSWORT_GESETZT).toBe('Passwort gesetzt. Melde dich mit dem neuen Passwort an.')
    })

    test('beendet die Sitzung nicht: sie bleibt PIN_VERIFIED', async () => {
      const sitzungsende = vi.fn()
      sitzungsendeBehandeln(sitzungsende)
      rendern()
      ausfuellen()

      speichern()

      await screen.findByTestId('ziel')
      expect(sitzungsende).not.toHaveBeenCalled()
    })
  })

  describe('Fehler', () => {
    test('401 RESET_PIN_FALSCH: Text am PIN-Feld, PIN leer, Passwort bleibt, Fokus im PIN-Feld', async () => {
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          problem(401, 'RESET_PIN_FALSCH', 'Die PIN ist nicht korrekt. Noch 3 Versuche.'),
        ),
      )
      rendern()
      ausfuellen('99999', 'beispiel-passwort-02')

      speichern()

      expect(await screen.findByTestId('reset-pin-feld-fehler')).toHaveTextContent(
        'Die PIN ist nicht korrekt. Noch 3 Versuche.',
      )
      expect(screen.queryByTestId('passwort-neu-fehler')).not.toBeInTheDocument()
      expect(screen.getByTestId('reset-pin-feld')).toHaveValue('')
      expect(screen.getByTestId('passwort-neu-passwort')).toHaveValue('beispiel-passwort-02')
      await waitFor(() => expect(screen.getByTestId('reset-pin-feld')).toHaveFocus())
    })

    test('401 RESET_PIN_FALSCH ist kein Sitzungsende', async () => {
      const sitzungsende = vi.fn()
      sitzungsendeBehandeln(sitzungsende)
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          problem(401, 'RESET_PIN_FALSCH', 'Die PIN ist nicht korrekt.'),
        ),
      )
      rendern()
      ausfuellen()

      speichern()

      await screen.findByTestId('reset-pin-feld-fehler')
      expect(sitzungsende).not.toHaveBeenCalled()
    })

    test('409 RESET_UNGUELTIG: Kasten mit „Neue PIN anfordern" statt nochmal versuchen', async () => {
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          problem(409, 'RESET_UNGUELTIG', 'Die PIN ist abgelaufen. Bitte fordere eine neue an.'),
        ),
      )
      rendern()
      ausfuellen()

      speichern()

      expect(await screen.findByTestId('passwort-neu-fehler')).toHaveTextContent(
        'Die PIN ist abgelaufen. Bitte fordere eine neue an.',
      )
      expect(screen.getByTestId('passwort-neu-neu-anfordern')).toHaveAttribute(
        'href',
        '/admin/passwort/vergessen',
      )
      expect(screen.queryByTestId('reset-pin-feld-fehler')).not.toBeInTheDocument()
    })

    test('zeigt „Neue PIN anfordern" nur bei 409', async () => {
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.'),
        ),
      )
      rendern()
      ausfuellen()

      speichern()

      expect(await screen.findByTestId('passwort-neu-fehler')).toHaveTextContent('Unerwarteter Fehler.')
      expect(screen.queryByTestId('passwort-neu-neu-anfordern')).not.toBeInTheDocument()
    })

    test('400 mit felder.bestaetigungsPin: Text am PIN-Feld', async () => {
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          eingabeUngueltig({ bestaetigungsPin: 'Die PIN muss aus 5 Ziffern bestehen.' }),
        ),
      )
      rendern()
      ausfuellen()

      speichern()

      expect(await screen.findByTestId('reset-pin-feld-fehler')).toHaveTextContent(
        'Die PIN muss aus 5 Ziffern bestehen.',
      )
      expect(screen.queryByTestId('passwort-neu-fehler')).not.toBeInTheDocument()
    })

    test('400 mit felder.neuesPasswort: Text am Passwortfeld, PIN bleibt', async () => {
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          eingabeUngueltig({ neuesPasswort: 'Das Passwort muss mindestens 10 Zeichen lang sein.' }),
        ),
      )
      rendern()
      ausfuellen()

      speichern()

      expect(await screen.findByTestId('passwort-neu-passwort-fehler')).toHaveTextContent(
        'Das Passwort muss mindestens 10 Zeichen lang sein.',
      )
      expect(screen.queryByTestId('passwort-neu-fehler')).not.toBeInTheDocument()
      // Ein Passwort, das an der Regel scheitert, kostet keinen Versuch: PIN bleibt.
      expect(screen.getByTestId('reset-pin-feld')).toHaveValue('12345')
    })

    test('429 PIN_GESPERRT: Text des Servers, „Passwort speichern" bleibt gesperrt', async () => {
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          HttpResponse.json(
            {
              type: 'about:blank',
              status: 429,
              code: 'PIN_GESPERRT',
              detail: 'Zu viele Fehlversuche. Bitte in 58 Sekunden erneut versuchen.',
              wartesekunden: 58,
            },
            { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        ),
      )
      rendern()
      ausfuellen()

      speichern()

      expect(await screen.findByTestId('passwort-neu-fehler')).toHaveTextContent(
        'Zu viele Fehlversuche. Bitte in 58 Sekunden erneut versuchen.',
      )
      expect(screen.getByTestId('passwort-neu-absenden')).toBeDisabled()
    })

    test('401 SESSION_UNGUELTIG: globale Behandlung', async () => {
      const sitzungsende = vi.fn()
      sitzungsendeBehandeln(sitzungsende)
      mockServer.use(
        http.post('*/auth/passwort/bestaetigen', () =>
          problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
        ),
      )
      rendern()
      ausfuellen()

      speichern()

      await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
    })

    test('Netzfehler: Meldung, Eingaben bleiben, neuer Versuch möglich', async () => {
      mockServer.use(http.post('*/auth/passwort/bestaetigen', () => HttpResponse.error()))
      rendern()
      ausfuellen()

      speichern()

      expect(await screen.findByTestId('passwort-neu-fehler')).toHaveTextContent(
        TEXT_NICHT_ERREICHBAR.replace('\n', ' '),
      )
      // Es kam keine Antwort: Die PIN war nicht falsch und bleibt stehen.
      expect(screen.getByTestId('reset-pin-feld')).toHaveValue('12345')
      expect(screen.getByTestId('passwort-neu-absenden')).toBeEnabled()
    })
  })
})
