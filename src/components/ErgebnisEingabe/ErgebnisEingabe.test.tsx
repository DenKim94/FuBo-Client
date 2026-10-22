import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, test, vi } from 'vitest'
import ErgebnisEingabe, { type ErgebnisWahl } from './ErgebnisEingabe'

/** Kontrolliert wie die Aufrufer: der Zustand liegt außen. */
function Huelle({ start, beiAenderung }: { start: ErgebnisWahl; beiAenderung?: (w: ErgebnisWahl) => void }) {
  const [wahl, setzeWahl] = useState(start)
  return (
    <ErgebnisEingabe
      {...wahl}
      beiAenderung={(neu) => {
        setzeWahl(neu)
        beiAenderung?.(neu)
      }}
    />
  )
}

describe('ErgebnisEingabe', () => {
  test('zeigt drei Ausgänge und den Haken „Deutlicher Sieg“; ohne Vorgabe ist nichts gewählt', () => {
    render(<Huelle start={{ sieger: null, deutlich: false }} />)

    expect(screen.getByRole('group', { name: 'Wer hat gewonnen?' })).toBeInTheDocument()
    expect(screen.getByTestId('ergebnis-sieger-a')).not.toBeChecked()
    expect(screen.getByTestId('ergebnis-sieger-b')).not.toBeChecked()
    expect(screen.getByTestId('ergebnis-sieger-u')).not.toBeChecked()
    expect(screen.getByTestId('ergebnis-deutlich')).not.toBeChecked()
    expect(screen.queryByTestId('ergebnis-deutlich-grund')).not.toBeInTheDocument()
  })

  test('meldet die Wahl eines Siegers samt unverändertem Haken', async () => {
    const beiAenderung = vi.fn()
    render(<Huelle start={{ sieger: 'A', deutlich: true }} beiAenderung={beiAenderung} />)

    await userEvent.click(screen.getByTestId('ergebnis-sieger-b'))

    expect(beiAenderung).toHaveBeenCalledWith({ sieger: 'B', deutlich: true })
    expect(screen.getByTestId('ergebnis-deutlich')).toBeChecked()
  })

  test('Unentschieden setzt „deutlich“ zurück, sperrt den Haken und nennt den Grund (M11)', async () => {
    const beiAenderung = vi.fn()
    render(<Huelle start={{ sieger: 'A', deutlich: true }} beiAenderung={beiAenderung} />)

    await userEvent.click(screen.getByTestId('ergebnis-sieger-u'))

    expect(beiAenderung).toHaveBeenLastCalledWith({ sieger: 'U', deutlich: false })
    const haken = screen.getByTestId('ergebnis-deutlich')
    expect(haken).toBeDisabled()
    expect(haken).not.toBeChecked()
    expect(screen.getByTestId('ergebnis-deutlich-grund')).toHaveTextContent('Nur bei einem Sieg möglich.')
    expect(haken).toHaveAccessibleDescription('Nur bei einem Sieg möglich.')
  })

  test('nach Unentschieden geht „deutlich“ wieder, sobald ein Sieger gewählt ist', async () => {
    render(<Huelle start={{ sieger: 'U', deutlich: false }} />)

    await userEvent.click(screen.getByTestId('ergebnis-sieger-a'))
    await userEvent.click(screen.getByTestId('ergebnis-deutlich'))

    expect(screen.getByTestId('ergebnis-deutlich')).toBeChecked()
    expect(screen.queryByTestId('ergebnis-deutlich-grund')).not.toBeInTheDocument()
  })

  test('deaktiviert sperrt alle vier Eingaben', () => {
    render(<ErgebnisEingabe sieger="A" deutlich={false} beiAenderung={() => {}} deaktiviert />)

    for (const id of ['ergebnis-sieger-a', 'ergebnis-sieger-b', 'ergebnis-sieger-u', 'ergebnis-deutlich']) {
      expect(screen.getByTestId(id)).toBeDisabled()
    }
  })
})
