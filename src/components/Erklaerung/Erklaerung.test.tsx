import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Erklaerung from './Erklaerung'

describe('Erklaerung', () => {
  test('blendet den Text per Tipp ein und aus und meldet den Zustand', () => {
    render(<Erklaerung text="Gaeste haben kein eigenes Profil." beschriftung="Was heisst Gast?" />)
    const schalter = screen.getByRole('button', { name: 'Was heisst Gast?' })
    const text = screen.getByTestId('erklaerung-text')

    expect(schalter).toHaveAttribute('aria-expanded', 'false')
    expect(text).not.toBeVisible()

    fireEvent.click(schalter)
    expect(schalter).toHaveAttribute('aria-expanded', 'true')
    expect(text).toBeVisible()
    // aria-controls zeigt auf ein vorhandenes Element – auch eingeklappt.
    expect(schalter.getAttribute('aria-controls')).toBe(text.id)

    fireEvent.click(schalter)
    expect(text).not.toBeVisible()
  })
})
