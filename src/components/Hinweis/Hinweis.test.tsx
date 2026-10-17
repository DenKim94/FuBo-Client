import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Hinweis from './Hinweis'

describe('Hinweis', () => {
  test('meldet den Text hoeflich als Status, nicht als Alarm', () => {
    render(<Hinweis>Passwort gesetzt.</Hinweis>)
    // Kein Fehler: `role="alert"` unterbraeche den Screenreader.
    expect(screen.getByRole('status')).toHaveTextContent('Passwort gesetzt.')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
