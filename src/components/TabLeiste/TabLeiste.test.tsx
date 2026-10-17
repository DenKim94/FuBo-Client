import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import TabLeiste from './TabLeiste'

function rendern(pfad: string) {
  const router = createMemoryRouter(
    [{ path: '*', element: <><TabLeiste /><p>Inhalt</p></> }],
    { initialEntries: [pfad] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('TabLeiste', () => {
  test('ist eine Navigation mit vier Links und ohne Tab-Rollen', () => {
    // Die Route wechselt, kein Bereich auf derselben Seite: Das Tab-Muster waere falsch (E11).
    rendern('/')
    const nav = screen.getByRole('navigation', { name: 'Bereiche' })
    expect(nav).toBeInTheDocument()
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Termine', 'Teams', 'Ergebnisse', 'Verlauf'])
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })

  test('markiert auf / nur „Termine“ als aktuell', () => {
    // Ohne `end` waere „Termine“ auf jeder Seite aktiv, `/` ist Praefix aller Pfade.
    rendern('/')
    expect(screen.getByTestId('tab-termine')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('tab-teams')).not.toHaveAttribute('aria-current')
  })

  test.each([
    ['/teams', 'tab-teams'],
    ['/ergebnisse', 'tab-ergebnisse'],
    ['/verlauf', 'tab-verlauf'],
  ])('markiert %s als aktuell', (pfad, testId) => {
    rendern(pfad)
    expect(screen.getByTestId(testId)).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('tab-termine')).not.toHaveAttribute('aria-current')
  })

  test('wechselt per Klick die Route', async () => {
    const router = rendern('/')
    await userEvent.click(screen.getByTestId('tab-verlauf'))
    expect(router.state.location.pathname).toBe('/verlauf')
    expect(screen.getByTestId('tab-verlauf')).toHaveAttribute('aria-current', 'page')
  })
})
