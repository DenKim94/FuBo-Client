import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TEXT_NICHT_ERREICHBAR } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { HINWEIS_PASSWORT_GEAENDERT } from '@/hooks/usePasswortAendern'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import PasswortAendern from './PasswortAendern'

/** Rendert die Ansicht. */
function rendern() {
  return render(
    <QueryUmgebung>
      <MemoryRouter>
        <PasswortAendern />
      </MemoryRouter>
    </QueryUmgebung>,
  )
}

/** Füllt beide Felder. */
function ausfuellen(alt = 'beispiel-passwort-01', neu = 'beispiel-passwort-02') {
  fireEvent.change(screen.getByTestId('passwort-aendern-alt'), { target: { value: alt } })
  fireEvent.change(screen.getByTestId('passwort-aendern-neu'), { target: { value: neu } })
}

/** Schickt die Änderung ab. */
function absenden() {
  fireEvent.click(screen.getByTestId('passwort-aendern-absenden'))
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

describe('PasswortAendern', () => {
  test('zeigt zwei Passwortfelder mit passender Eingabehilfe und die Regelliste', () => {
    rendern()

    expect(screen.getByRole('heading', { name: 'Passwort ändern' })).toBeInTheDocument()
    expect(screen.getByLabelText('Bisheriges Passwort')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(screen.getByLabelText('Neues Passwort')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Neues Passwort')).toHaveAccessibleDescription(/mindestens 10 Zeichen/)
    // Kein Wiederholungsfeld (E3): das Auge am Feld ist die Kontrolle gegen Tippfehler.
    expect(screen.getByTestId('passwort-aendern-neu-zeigen')).toBeInTheDocument()
    // Genau zwei Eingaben (die Umschalter heißen ebenfalls „Passwort anzeigen“, sind aber keine Felder).
    expect(document.querySelectorAll('input[autocomplete$="password"]')).toHaveLength(2)
  })

  test('sperrt „Passwort ändern", bis das alte ausgefüllt und das neue lang genug ist', () => {
    rendern()
    const knopf = screen.getByTestId('passwort-aendern-absenden')
    expect(knopf).toBeDisabled()

    ausfuellen('', 'beispiel-passwort-02')
    expect(knopf).toBeDisabled()

    ausfuellen('beispiel-passwort-01', 'zu-kurz')
    expect(knopf).toBeDisabled()

    ausfuellen('x', 'beispiel-passwort-02')
    // Das bisherige Passwort hat im Vertrag keine Mindestlänge.
    expect(knopf).toBeEnabled()
  })

  test('204: schickt beide Passwörter ab und beendet die Sitzung mit Hinweis', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/admin/passwort/aendern', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern()
    ausfuellen()

    absenden()

    await waitFor(() => expect(sitzungsende).toHaveBeenCalledExactlyOnceWith(HINWEIS_PASSWORT_GEAENDERT))
    expect(gesendet).toEqual({
      altesPasswort: 'beispiel-passwort-01',
      neuesPasswort: 'beispiel-passwort-02',
    })
  })

  describe('Fehler', () => {
    test('401 ADMIN_PASSWORT_FALSCH: Text am alten Feld, nur dieses leer, Fokus dort, kein Sitzungsende', async () => {
      const sitzungsende = vi.fn()
      sitzungsendeBehandeln(sitzungsende)
      mockServer.use(
        http.post('*/admin/passwort/aendern', () =>
          problem(401, 'ADMIN_PASSWORT_FALSCH', 'Das bisherige Passwort ist nicht korrekt.'),
        ),
      )
      rendern()
      ausfuellen('falsches-passwort', 'beispiel-passwort-02')

      absenden()

      expect(await screen.findByTestId('passwort-aendern-alt-fehler')).toHaveTextContent(
        'Das bisherige Passwort ist nicht korrekt.',
      )
      expect(screen.queryByTestId('passwort-aendern-fehler')).not.toBeInTheDocument()
      expect(screen.getByTestId('passwort-aendern-alt')).toHaveValue('')
      expect(screen.getByTestId('passwort-aendern-neu')).toHaveValue('beispiel-passwort-02')
      await waitFor(() => expect(screen.getByTestId('passwort-aendern-alt')).toHaveFocus())
      expect(sitzungsende).not.toHaveBeenCalled()
    })

    test('400 mit felder: Text am jeweiligen Feld', async () => {
      mockServer.use(
        http.post('*/admin/passwort/aendern', () =>
          eingabeUngueltig({
            altesPasswort: 'Das bisherige Passwort darf nicht leer sein.',
            neuesPasswort: 'Das Passwort muss mindestens 10 Zeichen lang sein.',
          }),
        ),
      )
      rendern()
      ausfuellen()

      absenden()

      expect(await screen.findByTestId('passwort-aendern-alt-fehler')).toHaveTextContent(
        'Das bisherige Passwort darf nicht leer sein.',
      )
      expect(screen.getByTestId('passwort-aendern-neu-fehler')).toHaveTextContent(
        'Das Passwort muss mindestens 10 Zeichen lang sein.',
      )
      expect(screen.queryByTestId('passwort-aendern-fehler')).not.toBeInTheDocument()
    })

    test('401 SESSION_UNGUELTIG: globale Behandlung', async () => {
      const sitzungsende = vi.fn()
      sitzungsendeBehandeln(sitzungsende)
      mockServer.use(
        http.post('*/admin/passwort/aendern', () =>
          problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
        ),
      )
      rendern()
      ausfuellen()

      absenden()

      await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
    })

    test('429 PIN_GESPERRT: Text des Servers, Schaltfläche bleibt gesperrt', async () => {
      mockServer.use(
        http.post('*/admin/passwort/aendern', () =>
          HttpResponse.json(
            {
              type: 'about:blank',
              status: 429,
              code: 'PIN_GESPERRT',
              detail: 'Zu viele Fehlversuche. Bitte in 30 Sekunden erneut versuchen.',
              wartesekunden: 30,
            },
            { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        ),
      )
      rendern()
      ausfuellen()

      absenden()

      expect(await screen.findByTestId('passwort-aendern-fehler')).toHaveTextContent(
        'Zu viele Fehlversuche. Bitte in 30 Sekunden erneut versuchen.',
      )
      expect(screen.getByTestId('passwort-aendern-absenden')).toBeDisabled()
    })

    test('Netzfehler: Meldung, beide Eingaben bleiben stehen', async () => {
      mockServer.use(http.post('*/admin/passwort/aendern', () => HttpResponse.error()))
      rendern()
      ausfuellen()

      absenden()

      expect(await screen.findByTestId('passwort-aendern-fehler')).toHaveTextContent(
        TEXT_NICHT_ERREICHBAR.replace('\n', ' '),
      )
      expect(screen.getByTestId('passwort-aendern-alt')).toHaveValue('beispiel-passwort-01')
      expect(screen.getByTestId('passwort-aendern-neu')).toHaveValue('beispiel-passwort-02')
    })
  })
})
