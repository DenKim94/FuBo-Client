import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { ORT_MAX, type TerminWerte } from '@/api/admin/terminEingabe'
import TerminFormular, { type TerminFormularFehler } from './TerminFormular'

const leer: TerminWerte = { datum: '', uhrzeit: '', ort: '' }

/** Controlled, wie der Elternbaustein es hält. */
function Huelle({
  start = leer,
  fehler,
  beiAenderung,
}: {
  start?: TerminWerte
  fehler?: TerminFormularFehler
  beiAenderung?: (feld: keyof TerminWerte, wert: string) => void
}) {
  const [werte, setWerte] = useState(start)
  return (
    <TerminFormular
      werte={werte}
      min="2099-01-01"
      fehler={fehler}
      beiAenderung={(feld, wert) => {
        beiAenderung?.(feld, wert)
        setWerte((alt) => ({ ...alt, [feld]: wert }))
      }}
    />
  )
}

describe('TerminFormular', () => {
  test('zeigt Datum, Uhrzeit und Ort mit Beschriftung und setzt min am Datum', () => {
    render(<Huelle />)

    expect(screen.getByLabelText('Datum')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Datum')).toHaveAttribute('min', '2099-01-01')
    expect(screen.getByLabelText('Uhrzeit')).toHaveAttribute('type', 'time')
    expect(screen.getByLabelText('Ort (optional)')).toHaveAttribute('maxlength', String(ORT_MAX))
  })

  test('meldet jede Eingabe mit Feld und Wert', async () => {
    const beiAenderung = vi.fn()
    render(<Huelle beiAenderung={beiAenderung} />)

    await userEvent.type(screen.getByTestId('termin-ort'), 'Halle')

    expect(beiAenderung).toHaveBeenLastCalledWith('ort', 'Halle')
    expect(screen.getByTestId('termin-ort')).toHaveValue('Halle')
  })

  test('zeigt den Zähler erst ab 140 Zeichen', () => {
    const { rerender } = render(<Huelle start={{ ...leer, ort: 'x'.repeat(139) }} />)
    expect(screen.queryByText(/von 160 Zeichen/)).not.toBeInTheDocument()

    rerender(<Huelle key="lang" start={{ ...leer, ort: 'x'.repeat(140) }} />)
    expect(screen.getByText('140 von 160 Zeichen')).toBeInTheDocument()
  })

  test('zeigt Fehlertexte am jeweiligen Feld und verknüpft sie', () => {
    render(<Huelle fehler={{ uhrzeit: 'Zu diesem Zeitpunkt gibt es bereits einen Termin.', datum: 'Bitte ein Datum.' }} />)

    expect(screen.getByTestId('termin-uhrzeit')).toHaveAccessibleDescription('Zu diesem Zeitpunkt gibt es bereits einen Termin.')
    expect(screen.getByTestId('termin-uhrzeit')).toBeInvalid()
    expect(screen.getByTestId('termin-datum-fehler')).toHaveTextContent('Bitte ein Datum.')
    expect(screen.getByTestId('termin-ort')).not.toBeInvalid()
  })

  test('verwendet den Test-ID-Vorsatz', () => {
    render(
      <TerminFormular werte={leer} min="2099-01-01" beiAenderung={() => undefined} vorsatz="serie" />,
    )

    expect(screen.getByTestId('serie-formular')).toBeInTheDocument()
    expect(screen.getByTestId('serie-datum')).toBeInTheDocument()
    expect(screen.getByTestId('serie-uhrzeit')).toBeInTheDocument()
    expect(screen.getByTestId('serie-ort')).toBeInTheDocument()
  })

  test('während eines Aufrufs sind die Felder schreibgeschützt, nicht deaktiviert', () => {
    render(<TerminFormular werte={leer} min="2099-01-01" beiAenderung={() => undefined} schreibgeschuetzt />)

    for (const id of ['termin-datum', 'termin-uhrzeit', 'termin-ort']) {
      expect(screen.getByTestId(id)).toHaveAttribute('readonly')
      expect(screen.getByTestId(id)).toBeEnabled()
    }
  })
})
