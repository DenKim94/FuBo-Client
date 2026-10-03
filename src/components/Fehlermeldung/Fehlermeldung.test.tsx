import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Fehlermeldung from './Fehlermeldung'

describe('Fehlermeldung', () => {
  test('meldet den Text als Alarm und verweist mit der id darauf', () => {
    render(
      <Fehlermeldung id="pin-fehler" data-testid="pin-fehler">
        Die PIN ist falsch.
      </Fehlermeldung>,
    )
    const meldung = screen.getByRole('alert')
    expect(meldung).toHaveTextContent('Die PIN ist falsch.')
    expect(meldung).toHaveAttribute('id', 'pin-fehler')
    // Das Symbol ist schmueckend: Die Aussage steht im Text.
    expect(screen.getByTestId('icon-error_circle_icon')).toHaveAttribute('aria-hidden', 'true')
  })
})
