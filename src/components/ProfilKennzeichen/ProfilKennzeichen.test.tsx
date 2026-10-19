import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import ProfilKennzeichen from './ProfilKennzeichen'

type Profil = Parameters<typeof ProfilKennzeichen>[0]['profil']

function profil(teil: Partial<Profil> = {}): Profil {
  return { spielerId: 7, rolle: 'USER', aktiv: true, belegt: false, ...teil }
}

describe('ProfilKennzeichen', () => {
  test('ein gewöhnliches Profil hat keine Marke', () => {
    render(<ProfilKennzeichen profil={profil()} skillsUnvollstaendig={false} />)

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  test('der Admin trägt „Admin“', () => {
    render(<ProfilKennzeichen profil={profil({ rolle: 'ADMIN' })} skillsUnvollstaendig={false} />)

    expect(screen.getByTestId('profil-admin-7')).toHaveTextContent('Admin')
  })

  test('ein gesperrtes Profil trägt „gesperrt“', () => {
    render(<ProfilKennzeichen profil={profil({ aktiv: false })} skillsUnvollstaendig={false} />)

    expect(screen.getByTestId('profil-gesperrt-7')).toHaveTextContent('gesperrt')
  })

  test('ein angemeldetes Profil trägt „online“', () => {
    render(<ProfilKennzeichen profil={profil({ belegt: true })} skillsUnvollstaendig={false} />)

    expect(screen.getByTestId('profil-online-7')).toHaveTextContent('online')
  })

  test('unvollständige Skillwerte sind ein Kennzeichen des Spielers', () => {
    render(<ProfilKennzeichen profil={profil()} skillsUnvollstaendig />)

    expect(screen.getByTestId('profil-skills-unvollstaendig-7')).toHaveTextContent('Skillwerte unvollständig')
  })

  test('der Admin hat keine Skillwerte, also auch keinen Hinweis darauf', () => {
    render(<ProfilKennzeichen profil={profil({ rolle: 'ADMIN' })} skillsUnvollstaendig />)

    expect(screen.queryByTestId('profil-skills-unvollstaendig-7')).not.toBeInTheDocument()
  })

  test('mehrere Marken stehen nebeneinander in der Liste', () => {
    render(<ProfilKennzeichen profil={profil({ aktiv: false, belegt: true })} skillsUnvollstaendig />)

    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
