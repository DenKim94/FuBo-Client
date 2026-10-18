import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminNameAendern, { HINWEIS_PIN_GESENDET } from './AdminNameAendern'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/** Zeigt Pfad und Zustand der Zielseite. */
function Ziel() {
  const ort = useLocation()
  return <p data-testid="ziel">{`${ort.pathname}|${JSON.stringify(ort.state)}`}</p>
}

function rendern() {
  return render(
    <QueryUmgebung>
      <MemoryRouter initialEntries={['/admin/name/aendern']}>
        <Routes>
          <Route path="/admin/name/aendern" element={<AdminNameAendern />} />
          <Route path="/admin/name/bestaetigen" element={<Ziel />} />
        </Routes>
      </MemoryRouter>
    </QueryUmgebung>,
  )
}

function namenEingeben(name: string) {
  fireEvent.change(screen.getByTestId('admin-name-neu'), { target: { value: name } })
}

describe('AdminNameAendern', () => {
  test('zeigt das Feld im Fokus, gesperrte Schaltfläche und den Link zu Schritt 2', () => {
    rendern()

    expect(screen.getByRole('heading', { name: 'Anmeldenamen ändern' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-name-neu')).toHaveFocus()
    expect(screen.getByTestId('admin-name-neu')).toHaveAttribute('autocapitalize', 'none')
    expect(screen.getByTestId('admin-name-anfordern')).toBeDisabled()
    expect(screen.getByTestId('admin-name-pin-vorhanden-link')).toHaveAttribute('href', '/admin/name/bestaetigen')
  })

  test('nur Leerzeichen gelten als leer', () => {
    rendern()

    namenEingeben('   ')

    expect(screen.getByTestId('admin-name-anfordern')).toBeDisabled()
  })

  test('202: sendet den getrimmten Namen und geht mit Hinweis und Namen zu Schritt 2', async () => {
    let gesendet: unknown
    mockServer.use(
      http.post('*/admin/name/aendern', async ({ request }) => {
        gesendet = await request.json()
        return new HttpResponse(null, { status: 202 })
      }),
    )
    rendern()
    namenEingeben('  neuer-admin  ')

    await userEvent.click(screen.getByTestId('admin-name-anfordern'))

    const ziel = await screen.findByTestId('ziel')
    expect(gesendet).toEqual({ neuerName: 'neuer-admin' })
    expect(ziel).toHaveTextContent('/admin/name/bestaetigen')
    expect(ziel).toHaveTextContent(JSON.stringify({ hinweis: HINWEIS_PIN_GESENDET, neuerName: 'neuer-admin' }))
  })

  test('409 NAME_BELEGT: Text am Feld, Fokus dort, kein Kasten', async () => {
    mockServer.use(
      http.post('*/admin/name/aendern', () => problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.')),
    )
    rendern()
    namenEingeben('vergeben')

    await userEvent.click(screen.getByTestId('admin-name-anfordern'))

    expect(await screen.findByTestId('admin-name-neu-fehler')).toHaveTextContent('Dieser Name ist bereits vergeben.')
    expect(screen.queryByTestId('admin-name-fehler')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('admin-name-neu')).toHaveFocus())
    expect(screen.getByTestId('admin-name-neu')).toHaveValue('vergeben')
  })

  test('400 mit felder.neuerName: Text am Feld', async () => {
    mockServer.use(
      http.post('*/admin/name/aendern', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 400,
            code: 'EINGABE_UNGUELTIG',
            detail: 'Die Eingabe ist ungültig.',
            felder: { neuerName: 'Der Name darf höchstens 60 Zeichen lang sein.' },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    rendern()
    namenEingeben('x')

    await userEvent.click(screen.getByTestId('admin-name-anfordern'))

    expect(await screen.findByTestId('admin-name-neu-fehler')).toHaveTextContent('höchstens 60 Zeichen')
  })

  test('503 VERSAND_FEHLGESCHLAGEN: Kasten, Schaltfläche heißt „Erneut versuchen“, Name bleibt', async () => {
    mockServer.use(
      http.post('*/admin/name/aendern', () =>
        problem(503, 'VERSAND_FEHLGESCHLAGEN', 'Die E-Mail konnte nicht gesendet werden.'),
      ),
    )
    rendern()
    namenEingeben('neuer-admin')

    await userEvent.click(screen.getByTestId('admin-name-anfordern'))

    expect(await screen.findByTestId('admin-name-fehler')).toHaveTextContent('Die E-Mail konnte nicht gesendet werden.')
    expect(screen.getByTestId('admin-name-anfordern')).toHaveTextContent('Erneut versuchen')
    expect(screen.getByTestId('admin-name-neu')).toHaveValue('neuer-admin')
  })

  test('429 PIN_GESPERRT: Text des Servers, Schaltfläche gesperrt', async () => {
    mockServer.use(
      http.post('*/admin/name/aendern', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'PIN_GESPERRT',
            detail: 'Zu viele Anforderungen. Bitte in 30 Sekunden erneut versuchen.',
            wartesekunden: 30,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )
    rendern()
    namenEingeben('neuer-admin')

    await userEvent.click(screen.getByTestId('admin-name-anfordern'))

    expect(await screen.findByTestId('admin-name-fehler')).toHaveTextContent('Zu viele Anforderungen')
    expect(screen.getByTestId('admin-name-anfordern')).toBeDisabled()
  })

  test('401 SESSION_UNGUELTIG: globale Behandlung', async () => {
    mockServer.use(
      http.post('*/admin/name/aendern', () => problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.')),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    rendern()
    namenEingeben('neuer-admin')

    await userEvent.click(screen.getByTestId('admin-name-anfordern'))

    await waitFor(() => expect(sitzungsende).toHaveBeenCalledOnce())
  })
})
