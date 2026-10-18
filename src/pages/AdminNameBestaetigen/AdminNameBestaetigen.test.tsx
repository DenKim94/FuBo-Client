import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminNameBestaetigen, { HINWEIS_NAME_GEAENDERT } from './AdminNameBestaetigen'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Zeigt Pfad und Zustand des Dashboards. */
function Ziel() {
  const ort = useLocation()
  return <p data-testid="ziel">{`${ort.pathname}|${JSON.stringify(ort.state)}`}</p>
}

function rendern(zustand?: unknown) {
  return render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={[{ pathname: '/admin/name/bestaetigen', state: zustand }]}>
        <Routes>
          <Route path="/admin/name/bestaetigen" element={<AdminNameBestaetigen />} />
          <Route path="/admin" element={<Ziel />} />
          <Route path="/admin/name/aendern" element={<p data-testid="schritt-1" />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
}

function pinEingeben(pin: string) {
  fireEvent.change(screen.getByTestId('admin-name-pin-feld'), { target: { value: pin } })
}

describe('AdminNameBestaetigen', () => {
  test('zeigt Hinweis und angeforderten Namen aus dem Zustand, Fokus im PIN-Feld', () => {
    rendern({ hinweis: 'Die PIN wurde an deine hinterlegte E-Mail-Adresse gesendet.', neuerName: 'neuer-admin' })

    expect(screen.getByTestId('admin-name-hinweis')).toHaveTextContent('Die PIN wurde an deine')
    expect(screen.getByTestId('admin-name-angefordert')).toHaveTextContent('neuer-admin')
    expect(screen.getByTestId('admin-name-pin-feld')).toHaveFocus()
    expect(screen.getByTestId('admin-name-bestaetigen')).toBeDisabled()
  })

  test('Direkteinstieg ohne Zustand: keine Namenszeile, kein Hinweis', () => {
    rendern()

    expect(screen.queryByTestId('admin-name-angefordert')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-name-hinweis')).not.toBeInTheDocument()
  })

  test('die Schaltfläche wird mit fünf Ziffern frei', () => {
    rendern()

    pinEingeben('1234')
    expect(screen.getByTestId('admin-name-bestaetigen')).toBeDisabled()
    pinEingeben('12345')
    expect(screen.getByTestId('admin-name-bestaetigen')).toBeEnabled()
  })

  test('204: sendet nur die PIN und geht mit Hinweis zum Dashboard; die Sitzung bleibt', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/admin/name/bestaetigen', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern({ neuerName: 'neuer-admin' })
    pinEingeben('12345')

    await userEvent.click(screen.getByTestId('admin-name-bestaetigen'))

    const ziel = await screen.findByTestId('ziel')
    expect(gesendet).toEqual({ bestaetigungsPin: '12345' })
    expect(ziel).toHaveTextContent('/admin')
    expect(ziel).toHaveTextContent(HINWEIS_NAME_GEAENDERT)
    expect(sitzungsende).not.toHaveBeenCalled()
  })

  test('401 NAME_PIN_FALSCH: Text am Feld, PIN geleert, Fokus dort, kein Sitzungsende', async () => {
    mockServer.use(
      http.post('*/admin/name/bestaetigen', () => problem(401, 'NAME_PIN_FALSCH', 'Die PIN ist nicht korrekt.')),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern()
    pinEingeben('11111')

    await userEvent.click(screen.getByTestId('admin-name-bestaetigen'))

    expect(await screen.findByTestId('admin-name-pin-feld-fehler')).toHaveTextContent('Die PIN ist nicht korrekt.')
    expect(screen.getByTestId('admin-name-pin-feld')).toHaveValue('')
    await waitFor(() => expect(screen.getByTestId('admin-name-pin-feld')).toHaveFocus())
    expect(screen.queryByTestId('admin-name-bestaetigen-fehler')).not.toBeInTheDocument()
    expect(sitzungsende).not.toHaveBeenCalled()
  })

  test.each<[Parameters<typeof problem>[1], string]>([
    ['NAME_AENDERUNG_UNGUELTIG', 'Die Anforderung ist abgelaufen oder ungültig.'],
    ['NAME_BELEGT', 'Dieser Name ist inzwischen vergeben.'],
  ])('409 %s: Kasten mit Link „Neu anfordern“, PIN bleibt stehen', async (code, text) => {
    mockServer.use(http.post('*/admin/name/bestaetigen', () => problem(409, code, text)))
    rendern()
    pinEingeben('12345')

    await userEvent.click(screen.getByTestId('admin-name-bestaetigen'))

    expect(await screen.findByTestId('admin-name-bestaetigen-fehler')).toHaveTextContent(text)
    expect(screen.getByTestId('admin-name-neu-anfordern')).toHaveAttribute('href', '/admin/name/aendern')
    expect(screen.getByTestId('admin-name-pin-feld')).toHaveValue('12345')
  })

  test('429 PIN_GESPERRT: Text des Servers, Schaltfläche gesperrt, PIN bleibt', async () => {
    mockServer.use(
      http.post('*/admin/name/bestaetigen', () =>
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
    pinEingeben('12345')

    await userEvent.click(screen.getByTestId('admin-name-bestaetigen'))

    expect(await screen.findByTestId('admin-name-bestaetigen-fehler')).toHaveTextContent('Zu viele Fehlversuche')
    expect(screen.getByTestId('admin-name-bestaetigen')).toBeDisabled()
    expect(screen.getByTestId('admin-name-pin-feld')).toHaveValue('12345')
  })

  test('Netzfehler: Meldung, PIN bleibt stehen', async () => {
    mockServer.use(http.post('*/admin/name/bestaetigen', () => HttpResponse.error()))
    rendern()
    pinEingeben('12345')

    await userEvent.click(screen.getByTestId('admin-name-bestaetigen'))

    expect(await screen.findByTestId('admin-name-bestaetigen-fehler')).toBeInTheDocument()
    expect(screen.getByTestId('admin-name-pin-feld')).toHaveValue('12345')
  })

  test('401 SESSION_UNGUELTIG: globale Behandlung', async () => {
    mockServer.use(
      http.post('*/admin/name/bestaetigen', () => problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.')),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern()
    pinEingeben('12345')

    await userEvent.click(screen.getByTestId('admin-name-bestaetigen'))

    await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
  })
})
