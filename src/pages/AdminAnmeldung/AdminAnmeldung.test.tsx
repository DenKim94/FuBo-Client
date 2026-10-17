import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TEXT_NICHT_ERREICHBAR } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminAnmeldung from './AdminAnmeldung'

/** Rendert die Ansicht in einem Router, optional mit Navigationszustand (Hinweis). */
function rendern(state?: unknown) {
  return render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[{ pathname: '/admin/anmelden', state }]}>
        <Routes>
          <Route path="/admin/anmelden" element={<AdminAnmeldung />} />
          <Route path="/admin/passwort/vergessen" element={<p data-testid="ziel-vergessen" />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
}

/** Füllt beide Felder. */
function ausfuellen(name = 'Beispieladmin', passwort = 'beispiel-passwort-01') {
  fireEvent.change(screen.getByTestId('admin-name'), { target: { value: name } })
  fireEvent.change(screen.getByTestId('admin-passwort'), { target: { value: passwort } })
}

/** Schickt das Formular über die Schaltfläche ab. */
function absenden() {
  fireEvent.click(screen.getByTestId('admin-absenden'))
}

/** Antwort `400 EINGABE_UNGUELTIG` mit Feldmeldungen. */
function eingabeUngueltig(felder?: Record<string, string>) {
  return HttpResponse.json(
    {
      type: 'about:blank',
      status: 400,
      code: 'EINGABE_UNGUELTIG',
      detail: 'Die Eingabe ist ungültig.',
      ...(felder ? { felder } : {}),
    },
    { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('AdminAnmeldung', () => {
  test('zeigt Überschrift, beschriftete Felder und die Verweise', () => {
    rendern()

    expect(screen.getByRole('heading', { name: 'Administration – Anmelden' })).toBeInTheDocument()
    const name = screen.getByLabelText('Name')
    expect(name).toHaveFocus()
    expect(name).toHaveAccessibleDescription('Groß- und Kleinschreibung beachten')
    expect(screen.getByLabelText('Passwort')).toHaveAttribute('type', 'password')
    expect(screen.getByTestId('admin-passwort-vergessen-link')).toHaveAttribute(
      'href',
      '/admin/passwort/vergessen',
    )
  })

  test('schreibt den Namen nicht gross und begrenzt ihn auf 60 Zeichen', () => {
    // Der Server vergleicht den Namen zeichengenau; iOS schriebe sonst gross.
    rendern()
    const name = screen.getByTestId('admin-name')
    expect(name).toHaveAttribute('autocapitalize', 'none')
    expect(name).toHaveAttribute('autocomplete', 'username')
    expect(name).toHaveAttribute('maxlength', '60')
    expect(screen.getByTestId('admin-passwort')).toHaveAttribute('autocomplete', 'current-password')
  })

  test('sperrt „Anmelden", bis Name und Passwort ausgefüllt sind', () => {
    rendern()
    expect(screen.getByTestId('admin-absenden')).toBeDisabled()
    fireEvent.change(screen.getByTestId('admin-name'), { target: { value: 'Beispieladmin' } })
    expect(screen.getByTestId('admin-absenden')).toBeDisabled()
    fireEvent.change(screen.getByTestId('admin-passwort'), { target: { value: 'x' } })
    expect(screen.getByTestId('admin-absenden')).toBeEnabled()
  })

  test('schickt Name und Passwort unverändert ab', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/auth/admin/anmelden', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    rendern()
    ausfuellen(' Beispieladmin ', ' beispiel passwort ')

    absenden()

    await waitFor(() =>
      expect(gesendet).toEqual({ anmeldename: ' Beispieladmin ', passwort: ' beispiel passwort ' }),
    )
  })

  test('navigiert nach dem Erfolg nicht selbst', async () => {
    // Der Guard (`LoginSchrittRoute`) leitet nach `zielFuerStufe` weiter.
    rendern()
    ausfuellen()
    absenden()
    await waitFor(() => expect(screen.getByTestId('admin-absenden')).toBeEnabled())
    expect(screen.getByTestId('admin-anmeldung')).toBeInTheDocument()
  })

  describe('Fehler', () => {
    test('401 ADMIN_PASSWORT_FALSCH: Text im Kasten, Passwort leer, Name bleibt, Fokus im Passwort', async () => {
      mockServer.use(
        http.post('*/auth/admin/anmelden', () =>
          problem(401, 'ADMIN_PASSWORT_FALSCH', 'Anmeldename oder Passwort ist nicht korrekt.'),
        ),
      )
      rendern()
      ausfuellen('Beispieladmin', 'falsches-passwort')

      absenden()

      const kasten = await screen.findByTestId('admin-fehler')
      expect(kasten).toHaveTextContent('Anmeldename oder Passwort ist nicht korrekt.')
      // Name und Passwort sind laut Vertrag nicht unterscheidbar: kein Text am Feld.
      expect(screen.queryByTestId('admin-name-fehler')).not.toBeInTheDocument()
      expect(screen.queryByTestId('admin-passwort-fehler')).not.toBeInTheDocument()
      expect(screen.getByTestId('admin-passwort')).toHaveValue('')
      expect(screen.getByTestId('admin-name')).toHaveValue('Beispieladmin')
      await waitFor(() => expect(screen.getByTestId('admin-passwort')).toHaveFocus())
      expect(screen.getByTestId('admin-passwort')).toHaveAccessibleDescription(
        'Anmeldename oder Passwort ist nicht korrekt.',
      )
    })

    test('400 mit felder: Text am jeweiligen Feld, kein Kasten', async () => {
      mockServer.use(
        http.post('*/auth/admin/anmelden', () =>
          eingabeUngueltig({
            anmeldename: 'Der Name ist zu lang.',
            passwort: 'Das Passwort darf nicht leer sein.',
          }),
        ),
      )
      rendern()
      ausfuellen()

      absenden()

      expect(await screen.findByTestId('admin-name-fehler')).toHaveTextContent('Der Name ist zu lang.')
      expect(screen.getByTestId('admin-passwort-fehler')).toHaveTextContent(
        'Das Passwort darf nicht leer sein.',
      )
      expect(screen.queryByTestId('admin-fehler')).not.toBeInTheDocument()
      expect(screen.getByTestId('admin-name')).toHaveAttribute('aria-invalid', 'true')
    })

    test('400 ohne felder: Text im Kasten', async () => {
      mockServer.use(http.post('*/auth/admin/anmelden', () => eingabeUngueltig()))
      rendern()
      ausfuellen()

      absenden()

      expect(await screen.findByTestId('admin-fehler')).toHaveTextContent('Die Eingabe ist ungültig.')
    })

    test('401 SESSION_UNGUELTIG: globale Behandlung', async () => {
      const sitzungsende = vi.fn()
      sitzungsendeBehandeln(sitzungsende)
      mockServer.use(
        http.post('*/auth/admin/anmelden', () =>
          problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
        ),
      )
      rendern()
      ausfuellen()

      absenden()

      await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
    })

    test('429 PIN_GESPERRT: Text des Servers, „Anmelden" bleibt gesperrt', async () => {
      mockServer.use(
        http.post('*/auth/admin/anmelden', () =>
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

      absenden()

      expect(await screen.findByTestId('admin-fehler')).toHaveTextContent(
        'Zu viele Fehlversuche. Bitte in 58 Sekunden erneut versuchen.',
      )
      expect(screen.getByTestId('admin-absenden')).toBeDisabled()
    })

    test('Netzfehler: Meldung, Eingaben bleiben stehen, neuer Versuch möglich', async () => {
      mockServer.use(http.post('*/auth/admin/anmelden', () => HttpResponse.error()))
      rendern()
      ausfuellen()

      absenden()

      expect(await screen.findByTestId('admin-fehler')).toHaveTextContent(
        TEXT_NICHT_ERREICHBAR.replace('\n', ' '),
      )
      // Es kam keine Antwort: Nichts war falsch, also bleibt auch das Passwort.
      expect(screen.getByTestId('admin-passwort')).toHaveValue('beispiel-passwort-01')
      expect(screen.getByTestId('admin-absenden')).toBeEnabled()
    })

    test('500: Meldung des Servers, neuer Versuch über denselben Knopf', async () => {
      mockServer.use(
        http.post('*/auth/admin/anmelden', () =>
          problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.'),
        ),
      )
      rendern()
      ausfuellen()

      absenden()

      expect(await screen.findByTestId('admin-fehler')).toHaveTextContent('Unerwarteter Fehler.')
      expect(screen.getByTestId('admin-absenden')).toBeEnabled()
      expect(screen.getByTestId('admin-passwort')).toHaveValue('beispiel-passwort-01')
    })
  })

  describe('Hinweis aus der Navigation', () => {
    const HINWEIS = 'Passwort gesetzt. Melde dich mit dem neuen Passwort an.'

    test('zeigt den Hinweis neutral als Status, nicht als Fehler', () => {
      rendern({ hinweis: HINWEIS })

      const hinweis = screen.getByTestId('admin-hinweis')
      expect(hinweis).toHaveTextContent(HINWEIS)
      expect(hinweis).toHaveAttribute('role', 'status')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    test('zeigt ohne Hinweis keinen', () => {
      rendern()
      expect(screen.queryByTestId('admin-hinweis')).not.toBeInTheDocument()
    })

    test('verschwindet mit der nächsten Eingabe', async () => {
      rendern({ hinweis: HINWEIS })

      fireEvent.change(screen.getByTestId('admin-name'), { target: { value: 'B' } })

      await waitFor(() => expect(screen.queryByTestId('admin-hinweis')).not.toBeInTheDocument())
    })

    test('verschwindet mit dem Absenden', async () => {
      rendern({ hinweis: HINWEIS })
      ausfuellen()

      absenden()

      await waitFor(() => expect(screen.queryByTestId('admin-hinweis')).not.toBeInTheDocument())
    })
  })
})
