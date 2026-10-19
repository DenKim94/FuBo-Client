import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import Schalter from './Schalter'

function rendern(teil: Partial<Parameters<typeof Schalter>[0]> = {}) {
  const beiUmschalten = vi.fn()
  render(
    <Schalter beschriftung="Aktiv in der Auswahlliste" an beiUmschalten={beiUmschalten} data-testid="s" {...teil} />,
  )
  return beiUmschalten
}

describe('Schalter', () => {
  test('ist ein Schalter mit der Beschriftung als Namen und dem Zustand', () => {
    rendern()

    const schalter = screen.getByRole('switch', { name: 'Aktiv in der Auswahlliste' })
    expect(schalter).toBe(screen.getByTestId('s'))
    expect(schalter).toHaveAttribute('aria-checked', 'true')
  })

  test('aus: aria-checked ist false', () => {
    rendern({ an: false })

    expect(screen.getByTestId('s')).toHaveAttribute('aria-checked', 'false')
  })

  test('meldet beim Antippen den neuen Zustand', async () => {
    const beiUmschalten = rendern({ an: true })
    await userEvent.click(screen.getByTestId('s'))
    expect(beiUmschalten).toHaveBeenLastCalledWith(false)
  })

  test('aus wird beim Antippen an', async () => {
    const beiUmschalten = rendern({ an: false })
    await userEvent.click(screen.getByTestId('s'))
    expect(beiUmschalten).toHaveBeenLastCalledWith(true)
  })

  test('Leertaste und Eingabetaste schalten um', async () => {
    const beiUmschalten = rendern()
    screen.getByTestId('s').focus()

    await userEvent.keyboard(' ')
    await userEvent.keyboard('{Enter}')

    expect(beiUmschalten).toHaveBeenCalledTimes(2)
  })

  test('sendet kein Formular ab', () => {
    const beiAbsenden = vi.fn((e: React.SyntheticEvent) => {
      e.preventDefault()
    })
    render(
      <form onSubmit={beiAbsenden}>
        <Schalter beschriftung="Aktiv" an beiUmschalten={() => {}} data-testid="im-formular" />
      </form>,
    )

    fireEvent.click(screen.getByTestId('im-formular'))

    expect(beiAbsenden).not.toHaveBeenCalled()
  })

  test('die Erklärung beschreibt den Zustand und trägt eine Test-ID', () => {
    rendern({ erklaerung: 'Aktiv: Das Profil steht in der Namensauswahl.' })

    expect(screen.getByTestId('s')).toHaveAccessibleDescription('Aktiv: Das Profil steht in der Namensauswahl.')
    expect(screen.getByTestId('s-text')).toHaveTextContent('Aktiv: Das Profil steht in der Namensauswahl.')
  })

  test('ohne Erklärung gibt es keine Beschreibung', () => {
    rendern()

    expect(screen.getByTestId('s')).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByTestId('s-text')).not.toBeInTheDocument()
  })

  test('beschäftigt: kein zweiter Aufruf, der Fokus bleibt, der Zustand wird gemeldet', async () => {
    const beiUmschalten = rendern({ beschaeftigt: true })
    const schalter = screen.getByTestId('s')
    schalter.focus()

    await userEvent.click(schalter)

    expect(beiUmschalten).not.toHaveBeenCalled()
    expect(schalter).not.toBeDisabled()
    expect(schalter).toHaveFocus()
    expect(schalter).toHaveAttribute('aria-disabled', 'true')
    expect(schalter).toHaveAttribute('aria-busy', 'true')
  })

  test('nicht beschäftigt: weder aria-disabled noch aria-busy', () => {
    rendern()

    expect(screen.getByTestId('s')).not.toHaveAttribute('aria-disabled')
    expect(screen.getByTestId('s')).not.toHaveAttribute('aria-busy')
  })
})
