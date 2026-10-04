import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { SitzungZustand } from '@/hooks/useSitzung'
import GeschuetzteRoute from './GeschuetzteRoute'

const sitzungMock = vi.fn<() => SitzungZustand>()
vi.mock('@/hooks/useSitzung', () => ({ useSitzung: () => sitzungMock() }))

// Der Ablauf-Dialog hat einen eigenen Test; hier zaehlt nur, ob er im
// geschuetzten Bereich haengt. Echt braeuchte er einen Query-Client und Server.
vi.mock('@/components/SitzungAblaufDialog/SitzungAblaufDialog', () => ({
  default: () => <div data-testid="sitzung-ablauf-dialog-attrappe" />,
}))

function zustand(teil: Partial<SitzungZustand> = {}): SitzungZustand {
  return {
    laedt: false,
    sitzung: null,
    angemeldet: false,
    pinGeprueft: false,
    istAdmin: false,
    istGast: false,
    ...teil,
  }
}

function startseiteOeffnen() {
  const router = createMemoryRouter(
    [
      { path: '/pin/pruefen', element: <p>PIN-Eingabe</p> },
      { path: '/anmelden', element: <p>Namensauswahl</p> },
      { element: <GeschuetzteRoute />, children: [{ path: '/', element: <p>Dashboard</p> }] },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('GeschuetzteRoute', () => {
  beforeEach(() => sitzungMock.mockReset())

  test('leitet nicht um, solange der Sitzungszustand unbekannt ist', () => {
    sitzungMock.mockReturnValue(zustand({ laedt: true }))
    startseiteOeffnen()
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('PIN-Eingabe')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  test('gibt die Ansicht bei abgeschlossener Anmeldung frei', () => {
    sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
    startseiteOeffnen()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  test('haengt den Ablauf-Dialog neben die freigegebene Ansicht', () => {
    sitzungMock.mockReturnValue(zustand({ angemeldet: true }))
    startseiteOeffnen()
    expect(screen.getByTestId('sitzung-ablauf-dialog-attrappe')).toBeInTheDocument()
  })

  test('zeigt den Ablauf-Dialog nicht, solange keine Anmeldung besteht', () => {
    // Ohne abgeschlossene Anmeldung gibt es nichts zu verlaengern; der Dialog
    // wuerde Login-Schritte unterbrechen und fragte eine Sitzung ab, die es
    // nicht gibt.
    sitzungMock.mockReturnValue(zustand({ pinGeprueft: true }))
    startseiteOeffnen()
    expect(screen.queryByTestId('sitzung-ablauf-dialog-attrappe')).not.toBeInTheDocument()

    sitzungMock.mockReturnValue(zustand({ laedt: true }))
    startseiteOeffnen()
    expect(screen.queryByTestId('sitzung-ablauf-dialog-attrappe')).not.toBeInTheDocument()
  })

  test('leitet ohne Sitzung zur PIN-Eingabe um', () => {
    sitzungMock.mockReturnValue(zustand())
    startseiteOeffnen()
    expect(screen.getByText('PIN-Eingabe')).toBeInTheDocument()
  })

  test('leitet in der Stufe PIN_VERIFIED zur Namensauswahl um', () => {
    // Die PIN allein genuegt nicht: Serverseitig sind in dieser Stufe nur die
    // Namensliste und die Namensauswahl erlaubt, alles andere liefert 403.
    sitzungMock.mockReturnValue(zustand({ pinGeprueft: true, angemeldet: false }))
    startseiteOeffnen()
    expect(screen.getByText('Namensauswahl')).toBeInTheDocument()
  })
})
