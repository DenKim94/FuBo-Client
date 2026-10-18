import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import Verwaltungsliste, { type Verwaltungsgruppe } from './Verwaltungsliste'

const GRUPPEN: Verwaltungsgruppe[] = [
  {
    titel: 'Verwaltung',
    eintraege: [
      { to: '/admin/profile', titel: 'Spielerprofile', text: 'Profile pflegen', symbol: 'manage_accounts_icon_dark', 'data-testid': 'admin-link-profile' },
      { to: '/admin/termine', titel: 'Termine', text: 'Anlegen und ändern', 'data-testid': 'admin-link-termine' },
    ],
  },
  {
    titel: 'Zugang',
    eintraege: [{ to: '/admin/pin', titel: 'Zentrale PIN', text: 'Neue PIN festlegen', 'data-testid': 'admin-link-pin' }],
  },
]

function rendern() {
  return render(
    <MemoryRouter>
      <Verwaltungsliste gruppen={GRUPPEN} />
    </MemoryRouter>,
  )
}

describe('Verwaltungsliste', () => {
  test('ist eine Navigation mit dem Namen „Verwaltung“ und einer h2 je Gruppe', () => {
    rendern()

    const navigation = screen.getByRole('navigation', { name: 'Verwaltung' })
    expect(within(navigation).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Verwaltung',
      'Zugang',
    ])
  })

  test('jeder Eintrag ist ein Link mit Titel, Satz und Ziel', () => {
    rendern()

    const link = screen.getByTestId('admin-link-profile')
    expect(link).toHaveAttribute('href', '/admin/profile')
    expect(link).toHaveTextContent('Spielerprofile')
    expect(link).toHaveTextContent('Profile pflegen')
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  test('verwendet keine ARIA-Tab-Rollen', () => {
    rendern()

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })

  test('zeigt das Symbol nur, wenn eines angegeben ist, und blendet es für Screenreader aus', () => {
    rendern()

    expect(screen.getByTestId('admin-link-profile').querySelector('[data-testid="icon-manage_accounts_icon_dark"]')).not.toBeNull()
    expect(screen.getByTestId('admin-link-termine').querySelector('[data-testid^="icon-"]')).toBeNull()
  })
})
