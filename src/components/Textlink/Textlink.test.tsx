import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import Textlink from './Textlink'

describe('Textlink', () => {
  test('ist ein Link mit Ziel und Test-ID', () => {
    render(
      <MemoryRouter>
        <Textlink to="/admin/anmelden" data-testid="beispiel-link">
          Als Admin anmelden
        </Textlink>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Als Admin anmelden' })
    expect(link).toHaveAttribute('href', '/admin/anmelden')
    expect(link).toHaveAttribute('data-testid', 'beispiel-link')
  })
})
