import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { SitzungZustand } from '@/hooks/useSitzung'
import AdminRoute from './AdminRoute'

const sitzungMock = vi.fn<() => SitzungZustand>()
vi.mock('@/hooks/useSitzung', () => ({ useSitzung: () => sitzungMock() }))

/** Baut einen Zustand mit sinnvollen Vorgaben. */
function zustand(teil: Partial<SitzungZustand> = {}): SitzungZustand {
  return {
    laedt: false,
    sitzung: null,
    angemeldet: true,
    pinGeprueft: false,
    istAdmin: false,
    istGast: false,
    ...teil,
  }
}

function adminbereichOeffnen() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Startseite</p> },
      { element: <AdminRoute />, children: [{ path: 'admin', element: <p>Adminbereich</p> }] },
    ],
    { initialEntries: ['/admin'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('AdminRoute', () => {
  beforeEach(() => sitzungMock.mockReset())

  test('rendert nichts, solange der Sitzungszustand unbekannt ist', () => {
    sitzungMock.mockReturnValue(zustand({ laedt: true, angemeldet: false }))
    adminbereichOeffnen()
    // Kein Flackern: weder der Adminbereich noch die Umleitung duerfen erscheinen.
    expect(screen.queryByText('Adminbereich')).not.toBeInTheDocument()
    expect(screen.queryByText('Startseite')).not.toBeInTheDocument()
  })

  test('gibt den Adminbereich fuer die Rolle ADMIN frei', () => {
    sitzungMock.mockReturnValue(zustand({ istAdmin: true }))
    adminbereichOeffnen()
    expect(screen.getByText('Adminbereich')).toBeInTheDocument()
  })

  test('leitet eine angemeldete Person ohne Adminrolle auf die Startseite', () => {
    sitzungMock.mockReturnValue(zustand({ istAdmin: false }))
    adminbereichOeffnen()
    // Nicht zur Anmeldung: Die Person ist angemeldet, nur nicht zustaendig.
    expect(screen.getByText('Startseite')).toBeInTheDocument()
    expect(screen.queryByText('Adminbereich')).not.toBeInTheDocument()
  })
})
