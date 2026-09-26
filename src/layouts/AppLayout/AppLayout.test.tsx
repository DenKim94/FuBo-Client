import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import AppLayout from './AppLayout'

/** Baut einen Speicher-Router mit dem Layout als Rahmen. */
function layoutRendern(startpfad: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <p>Start</p> },
          { path: 'anmelden', element: <p>Anmeldung</p> },
        ],
      },
    ],
    { initialEntries: [startpfad] },
  )
  return render(<RouterProvider router={router} />)
}

describe('AppLayout', () => {
  test('zeigt auf der Startseite keine Zurueck-Schaltflaeche', () => {
    layoutRendern('/')
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.queryByTestId('layout-zurueck')).not.toBeInTheDocument()
  })

  test('zeigt auf einer Unterseite eine Zurueck-Schaltflaeche', () => {
    layoutRendern('/anmelden')
    expect(screen.getByTestId('layout-zurueck')).toBeInTheDocument()
  })
})
