import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test } from 'vitest'
import { beispielKategorien, adminWelt, profilModell } from '@/test/mocks/admin'
import ProfilListe from './ProfilListe'

function rendern(profile = adminWelt().profile, mitKategorien = true) {
  return render(
    <MemoryRouter>
      <ProfilListe profile={profile} kategorien={mitKategorien ? beispielKategorien : undefined} />
    </MemoryRouter>,
  )
}

describe('ProfilListe', () => {
  test('zeigt jedes Profil in der Reihenfolge des Servers', () => {
    rendern()

    const reihenfolge = within(screen.getByTestId('profil-liste'))
      .getAllByTestId(/^profil-zeile-/)
      .map((zeile) => zeile.getAttribute('data-testid'))
    expect(reihenfolge).toEqual(['profil-zeile-1', 'profil-zeile-2', 'profil-zeile-3', 'profil-zeile-4', 'profil-zeile-5', 'profil-zeile-99'])
  })

  test('Spielerzeilen sind Links zur Bearbeitung', () => {
    rendern()

    expect(screen.getByTestId('profil-zeile-1')).toHaveAttribute('href', '/admin/profile/1')
  })

  test('die Zeile des Adminprofils ist kein Link und trägt keine Bilanz', () => {
    rendern()

    const admin = screen.getByTestId('profil-zeile-99')
    expect(admin.tagName).toBe('DIV')
    expect(admin).not.toHaveAttribute('href')
    expect(within(admin).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profil-bilanz-99')).not.toBeInTheDocument()
    expect(screen.getByTestId('profil-admin-99')).toHaveTextContent('Admin')
  })

  test('Kennzeichen stehen als Text: gesperrt, online', () => {
    rendern()

    expect(screen.getByTestId('profil-gesperrt-2')).toHaveTextContent('gesperrt')
    expect(screen.getByTestId('profil-online-3')).toHaveTextContent('online')
    expect(screen.queryByTestId('profil-gesperrt-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profil-online-1')).not.toBeInTheDocument()
  })

  test('kennzeichnet unvollständige Skillkarten, nicht die vollständigen und nicht das Adminprofil', () => {
    rendern()

    expect(screen.getByTestId('profil-skills-unvollstaendig-4')).toHaveTextContent('Skillwerte unvollständig')
    expect(screen.queryByTestId('profil-skills-unvollstaendig-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('profil-skills-unvollstaendig-99')).not.toBeInTheDocument()
  })

  test('ohne Kategorien (laden oder Ausfall) entfällt die Kennzeichnung still', () => {
    rendern(adminWelt().profile, false)

    expect(screen.queryByTestId('profil-skills-unvollstaendig-4')).not.toBeInTheDocument()
    expect(screen.getByTestId('profil-zeile-4')).toBeInTheDocument()
  })

  test('zeigt die Bilanz als „x S · y N · z U“', () => {
    rendern()

    expect(screen.getByTestId('profil-bilanz-1')).toHaveTextContent('3 S · 2 N · 1 U')
    expect(screen.getByTestId('profil-bilanz-5')).toHaveTextContent('0 S · 0 N · 0 U')
  })

  test('zeigt keine Skillwerte (A12)', () => {
    const profile = [
      profilModell({ spielerId: 1, name: 'Beispielspieler 01', skills: { ANGRIFF: 6, TORWART: 1 } }),
    ]
    rendern(profile)

    const liste = screen.getByTestId('profil-liste')
    expect(liste).not.toHaveTextContent(/Angriff|Torwart|Verteidigung/i)
    expect(liste.textContent).not.toMatch(/ANGRIFF|\b6\b/)
  })
})
