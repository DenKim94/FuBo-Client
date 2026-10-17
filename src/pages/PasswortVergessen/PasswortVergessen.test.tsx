import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TEXT_NICHT_ERREICHBAR } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import PasswortVergessen from './PasswortVergessen'

/** Zeigt den Navigationszustand der Zielansicht als Text. */
function Ziel() {
  const ort = useLocation()
  return <p data-testid="ziel">{JSON.stringify({ pfad: ort.pathname, state: ort.state })}</p>
}

/** Rendert die Ansicht in einem Router mit der Zielansicht von Schritt 2. */
function rendern() {
  return render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={['/admin/passwort/vergessen']}>
        <Routes>
          <Route path="/admin/passwort/vergessen" element={<PasswortVergessen />} />
          <Route path="/admin/passwort/neu" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
}

/** Fordert die PIN an. */
function anfordern() {
  fireEvent.click(screen.getByTestId('passwort-vergessen-absenden'))
}

/** Antwort `429 RESET_GEDROSSELT` mit Wartezeit. */
function gedrosselt() {
  return HttpResponse.json(
    {
      type: 'about:blank',
      status: 429,
      code: 'RESET_GEDROSSELT',
      detail: 'Zu viele Anforderungen. Bitte in 1800 Sekunden erneut versuchen.',
      wartesekunden: 1800,
    },
    { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
  )
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('PasswortVergessen', () => {
  test('erklärt den Schritt und bietet die Anforderung und den Direkteinstieg an', () => {
    rendern()

    expect(screen.getByRole('heading', { name: 'Passwort vergessen' })).toBeInTheDocument()
    expect(screen.getByTestId('passwort-vergessen-schritt')).toHaveTextContent('Schritt 1 von 2')
    expect(
      screen.getByText(/5-stellige Bestätigungs-PIN an die hinterlegte E-Mail-Adresse/),
    ).toBeInTheDocument()
    expect(screen.getByTestId('passwort-vergessen-absenden')).toHaveTextContent('PIN anfordern')
    expect(screen.getByTestId('passwort-vergessen-pin-vorhanden-link')).toHaveAttribute(
      'href',
      '/admin/passwort/neu',
    )
  })

  test('fordert nicht beim Betreten an, sondern nur auf Tipp', async () => {
    // Jede Anforderung entwertet die zuvor offene PIN.
    let aufrufe = 0
    mockServer.use(
      http.post('*/auth/passwort/zuruecksetzen', () => {
        aufrufe += 1
        return new HttpResponse(null, { status: 204 })
      }),
    )

    rendern()
    await new Promise((r) => setTimeout(r, 50))
    expect(aufrufe).toBe(0)

    anfordern()
    await waitFor(() => expect(aufrufe).toBe(1))
  })

  test('204: geht zu Schritt 2 und nimmt den Zeitpunkt der Anforderung mit', async () => {
    const vorher = Date.now()
    rendern()

    anfordern()

    const ziel = JSON.parse((await screen.findByTestId('ziel')).textContent ?? '{}') as {
      pfad: string
      state: { angefordertUm: number }
    }
    expect(ziel.pfad).toBe('/admin/passwort/neu')
    expect(ziel.state.angefordertUm).toBeGreaterThanOrEqual(vorher)
    expect(ziel.state.angefordertUm).toBeLessThanOrEqual(Date.now())
  })

  test('429 RESET_GEDROSSELT: Text des Servers, Anforderung bleibt gesperrt', async () => {
    mockServer.use(http.post('*/auth/passwort/zuruecksetzen', () => gedrosselt()))
    rendern()

    anfordern()

    expect(await screen.findByTestId('passwort-vergessen-fehler')).toHaveTextContent(
      'Zu viele Anforderungen. Bitte in 1800 Sekunden erneut versuchen.',
    )
    expect(screen.getByTestId('passwort-vergessen-absenden')).toBeDisabled()
    // Gesperrt heißt nicht „Erneut versuchen": Das wäre wieder 429.
    expect(screen.getByTestId('passwort-vergessen-absenden')).toHaveTextContent('PIN anfordern')
    expect(screen.queryByTestId('ziel')).not.toBeInTheDocument()
  })

  test('503 VERSAND_FEHLGESCHLAGEN: Meldung und „Erneut versuchen", der zweite Versuch geht', async () => {
    let versuche = 0
    mockServer.use(
      http.post('*/auth/passwort/zuruecksetzen', () => {
        versuche += 1
        return versuche === 1
          ? problem(503, 'VERSAND_FEHLGESCHLAGEN', 'Die E-Mail konnte nicht versendet werden.')
          : new HttpResponse(null, { status: 204 })
      }),
    )
    rendern()

    anfordern()

    expect(await screen.findByTestId('passwort-vergessen-fehler')).toHaveTextContent(
      'Die E-Mail konnte nicht versendet werden.',
    )
    const knopf = screen.getByTestId('passwort-vergessen-absenden')
    expect(knopf).toHaveTextContent('Erneut versuchen')
    expect(knopf).toBeEnabled()

    fireEvent.click(knopf)

    expect(await screen.findByTestId('ziel')).toBeInTheDocument()
    expect(versuche).toBe(2)
  })

  test('Netzfehler: Meldung und „Erneut versuchen"', async () => {
    mockServer.use(http.post('*/auth/passwort/zuruecksetzen', () => HttpResponse.error()))
    rendern()

    anfordern()

    expect(await screen.findByTestId('passwort-vergessen-fehler')).toHaveTextContent(
      TEXT_NICHT_ERREICHBAR.replace('\n', ' '),
    )
    expect(screen.getByTestId('passwort-vergessen-absenden')).toHaveTextContent('Erneut versuchen')
  })

  test('401 SESSION_UNGUELTIG: globale Behandlung', async () => {
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    mockServer.use(
      http.post('*/auth/passwort/zuruecksetzen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )
    rendern()

    anfordern()

    await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
  })
})
