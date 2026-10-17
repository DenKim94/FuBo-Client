import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import PasswortFeld from './PasswortFeld'

describe('PasswortFeld', () => {
  test('ist anfangs verborgen und schaltet mit dem Umschalter um', () => {
    render(<PasswortFeld beschriftung="Passwort" autoComplete="current-password" />)
    const feld = screen.getByLabelText('Passwort')
    const umschalter = screen.getByTestId('passwort-feld-zeigen')

    expect(feld).toHaveAttribute('type', 'password')
    expect(umschalter).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(umschalter)

    expect(feld).toHaveAttribute('type', 'text')
    expect(umschalter).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(umschalter)
    expect(feld).toHaveAttribute('type', 'password')
  })

  test('besteht nur aus einem schmückenden Auge, das die Aktion widerspiegelt', () => {
    render(<PasswortFeld beschriftung="Passwort" autoComplete="current-password" />)
    const umschalter = screen.getByTestId('passwort-feld-zeigen')
    const symbol = screen.getByTestId('passwort-feld-symbol')

    // Verborgen: Aktion „zeigen“ → offenes Auge.
    expect(symbol).toHaveAttribute('src', '/icons/visibility_on_dark.png')
    // Kein sichtbarer Text; schmückend (leerer `alt`), den Namen trägt `aria-label`.
    expect(umschalter).toHaveTextContent('')
    expect(symbol).toHaveAttribute('alt', '')
    expect(umschalter).toHaveAccessibleName('Passwort anzeigen')

    fireEvent.click(umschalter)

    // Sichtbar: Aktion „verbergen“ → durchgestrichenes Auge.
    expect(symbol).toHaveAttribute('src', '/icons/visibility_off_dark.png')
    // Der Name bleibt fest, den Zustand meldet `aria-pressed` (keine doppelte Aussage).
    expect(umschalter).toHaveAccessibleName('Passwort anzeigen')
    expect(umschalter).toHaveAttribute('aria-pressed', 'true')
  })

  test('ist ein Schalter, der kein Formular absendet', () => {
    let abgesendet = false
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          abgesendet = true
        }}
      >
        <PasswortFeld beschriftung="Passwort" autoComplete="current-password" />
      </form>,
    )
    fireEvent.click(screen.getByTestId('passwort-feld-zeigen'))
    expect(abgesendet).toBe(false)
  })

  test('verbirgt das Passwort wieder, wenn das Formular abgesendet wird', () => {
    // Kommt ein Fehler zurueck, darf das Passwort nicht lesbar stehen bleiben.
    render(
      <form onSubmit={(e) => e.preventDefault()} data-testid="formular">
        <PasswortFeld beschriftung="Passwort" autoComplete="current-password" />
      </form>,
    )
    fireEvent.click(screen.getByTestId('passwort-feld-zeigen'))
    expect(screen.getByLabelText('Passwort')).toHaveAttribute('type', 'text')

    fireEvent.submit(screen.getByTestId('formular'))

    expect(screen.getByLabelText('Passwort')).toHaveAttribute('type', 'password')
    expect(screen.getByTestId('passwort-feld-zeigen')).toHaveAttribute('aria-pressed', 'false')
  })

  test('setzt die festen Vorgaben fuer Passwoerter', () => {
    render(<PasswortFeld beschriftung="Neues Passwort" autoComplete="new-password" />)
    const feld = screen.getByLabelText('Neues Passwort')
    expect(feld).toHaveAttribute('autocomplete', 'new-password')
    expect(feld).toHaveAttribute('maxlength', '72')
    expect(feld).toHaveAttribute('autocapitalize', 'none')
    expect(feld).toHaveAttribute('autocorrect', 'off')
    expect(feld).toHaveAttribute('spellcheck', 'false')
  })

  test('trimmt das Passwort nicht', () => {
    let wert = ''
    render(
      <PasswortFeld
        beschriftung="Passwort"
        autoComplete="current-password"
        value=" a b "
        onChange={(e) => {
          wert = e.target.value
        }}
      />,
    )
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: '  leer zeichen  ' } })
    expect(wert).toBe('  leer zeichen  ')
  })

  test('hat ein Tap-Ziel mit eigener Test-ID und gibt Fehler am Feld aus', () => {
    render(
      <PasswortFeld
        beschriftung="Passwort"
        autoComplete="current-password"
        fehler="Das Passwort ist falsch."
        data-testid="admin-passwort"
      />,
    )
    expect(screen.getByTestId('admin-passwort')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('admin-passwort-zeigen')).toBeInTheDocument()
    expect(screen.getByTestId('admin-passwort-fehler')).toHaveTextContent('Das Passwort ist falsch.')
  })
})
