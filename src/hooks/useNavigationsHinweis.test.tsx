import { act, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import { useNavigationsHinweis } from './useNavigationsHinweis'

function Anzeige() {
  const { hinweis, verbergen } = useNavigationsHinweis()
  return (
    <>
      <p data-testid="text">{hinweis ?? 'kein Hinweis'}</p>
      <button type="button" onClick={verbergen}>
        verbergen
      </button>
    </>
  )
}

function oeffnen(state: unknown) {
  const router = createMemoryRouter([{ path: '/x', element: <Anzeige /> }], {
    initialEntries: [{ pathname: '/x', search: '?a=1', state }],
  })
  render(<RouterProvider router={router} />)
  return router
}

describe('useNavigationsHinweis', () => {
  test('liest den Hinweis aus dem Navigationszustand', () => {
    oeffnen({ hinweis: 'Passwort gesetzt.' })
    expect(screen.getByTestId('text')).toHaveTextContent('Passwort gesetzt.')
  })

  test.each([[null], [undefined], [{}], [{ hinweis: 42 }], [{ hinweis: '' }], ['text']])(
    'liefert keinen Hinweis bei %j',
    (state) => {
      oeffnen(state)
      expect(screen.getByTestId('text')).toHaveTextContent('kein Hinweis')
    },
  )

  test('verbergen ersetzt den Verlaufseintrag ohne Hinweis und behaelt den Rest', () => {
    const router = oeffnen({ hinweis: 'Passwort gesetzt.', von: '/teams/7' })

    act(() => screen.getByText('verbergen').click())

    expect(screen.getByTestId('text')).toHaveTextContent('kein Hinweis')
    // Gleicher Pfad samt Suchteil, `von` bleibt: Nur der Hinweis ist erledigt.
    expect(router.state.location.pathname).toBe('/x')
    expect(router.state.location.search).toBe('?a=1')
    expect(router.state.location.state).toEqual({ von: '/teams/7' })
  })

  test('verbergen raeumt den Zustand ganz ab, wenn nichts anderes darin steht', () => {
    const router = oeffnen({ hinweis: 'Passwort gesetzt.' })

    act(() => screen.getByText('verbergen').click())

    expect(router.state.location.state).toBeNull()
  })

  test('verbergen tut ohne Hinweis nichts', () => {
    const router = oeffnen({ von: '/teams/7' })
    const vorher = router.state.location.key

    act(() => screen.getByText('verbergen').click())

    expect(router.state.location.key).toBe(vorher)
  })
})
