import { fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import NichtGefunden from './NichtGefunden'

describe('NichtGefunden', () => {
  test('nennt den Grund und fuehrt zur Startseite', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Start</p> },
        { path: '*', element: <NichtGefunden /> },
      ],
      { initialEntries: ['/gibt-es-nicht'] },
    )
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Seite nicht gefunden' })).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('nicht-gefunden-start'))
    expect(await screen.findByText('Start')).toBeInTheDocument()
  })
})
