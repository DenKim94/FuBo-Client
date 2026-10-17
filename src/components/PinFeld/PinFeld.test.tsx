import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, test } from 'vitest'
import PinFeld from './PinFeld'

type Zusatz = Partial<Parameters<typeof PinFeld>[0]>

/** Das Feld ist gesteuert; der Test braucht den Zustand daneben. */
function Huelle({ anfang = '', ...zusatz }: Zusatz & { anfang?: string }) {
  const [wert, setWert] = useState(anfang)
  return (
    <PinFeld
      stellen={5}
      wert={wert}
      beiAenderung={setWert}
      beschriftung="Bestätigungs-PIN"
      {...zusatz}
    />
  )
}

function eintippen(text: string) {
  fireEvent.change(screen.getByTestId('pin-feld'), { target: { value: text } })
}

describe('PinFeld', () => {
  test('zeigt so viele Kaestchen wie Stellen und begrenzt die Eingabe darauf', () => {
    render(<Huelle stellen={5} />)
    expect(screen.getAllByTestId('pin-kasten')).toHaveLength(5)
    expect(screen.getByTestId('pin-feld')).toHaveAttribute('maxlength', '5')
  })

  test('fuellt die Kaestchen mit der Eingabe', () => {
    render(<Huelle />)
    eintippen('123')
    const gefuellt = screen.getAllByTestId('pin-kasten').filter((k) => k.dataset.gefuellt === 'true')
    expect(gefuellt).toHaveLength(3)
  })

  test('uebernimmt standardmaessig nur Ziffern', () => {
    render(<Huelle />)
    eintippen('1a2-3')
    expect(screen.getByTestId('pin-feld')).toHaveValue('123')
  })

  test('laesst mit nurZiffern=false jedes Zeichen zu (zentrale PIN)', () => {
    render(<Huelle stellen={4} nurZiffern={false} />)
    eintippen('a1b2')
    expect(screen.getByTestId('pin-feld')).toHaveValue('a1b2')
  })

  test('ist ein beschriftetes natives Feld mit Zifferntastatur', () => {
    render(<Huelle hinweis="Fünf Ziffern." />)
    const feld = screen.getByLabelText('Bestätigungs-PIN')
    expect(feld).toHaveAttribute('inputmode', 'numeric')
    expect(feld).toHaveAttribute('type', 'text')
    expect(feld).toHaveAccessibleDescription('Fünf Ziffern.')
    expect(feld).not.toHaveAttribute('aria-invalid')
  })

  test('verbietet Autofill standardmaessig und erlaubt one-time-code', () => {
    const { unmount } = render(<Huelle />)
    expect(screen.getByTestId('pin-feld')).toHaveAttribute('autocomplete', 'off')
    unmount()
    render(<Huelle autoComplete="one-time-code" />)
    expect(screen.getByTestId('pin-feld')).toHaveAttribute('autocomplete', 'one-time-code')
  })

  test('meldet einen Fehlertext am Feld auch ohne Farbe', () => {
    render(<Huelle hinweis="Fünf Ziffern." fehler="Die PIN ist falsch." />)
    const feld = screen.getByTestId('pin-feld')
    expect(feld).toHaveAttribute('aria-invalid', 'true')
    expect(feld).toHaveAccessibleDescription('Fünf Ziffern. Die PIN ist falsch.')
  })

  test('verknuepft den Fehlerkasten der Ansicht nur bei einem Fehler', () => {
    const { unmount } = render(
      <>
        <p id="kasten">Kasten der Ansicht</p>
        <Huelle beschriebenDurch="kasten" />
      </>,
    )
    expect(screen.getByTestId('pin-feld')).not.toHaveAccessibleDescription('Kasten der Ansicht')
    unmount()

    render(
      <>
        <p id="kasten">Kasten der Ansicht</p>
        <Huelle beschriebenDurch="kasten" fehlerhaft />
      </>,
    )
    expect(screen.getByTestId('pin-feld')).toHaveAccessibleDescription('Kasten der Ansicht')
    expect(screen.getByTestId('pin-feld')).toHaveAttribute('aria-invalid', 'true')
  })

  test('nutzt das Praefix der Test-IDs', () => {
    render(<Huelle testIdPraefix="reset-pin" />)
    expect(screen.getByTestId('reset-pin-feld')).toBeInTheDocument()
    expect(screen.getAllByTestId('reset-pin-kasten')).toHaveLength(5)
  })

  test('sperrt die Eingabe waehrend der Pruefung nur lesend', () => {
    render(<Huelle readOnly />)
    const feld = screen.getByTestId('pin-feld')
    // `disabled` nahme dem Feld den Fokus und schloesse die Tastatur.
    expect(feld).toHaveAttribute('readonly')
    expect(feld).not.toBeDisabled()
  })
})
