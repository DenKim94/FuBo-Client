import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import Haken from './Haken'

describe('Haken', () => {
  test('meldet den neuen Zustand und nennt den Hinweis als Beschreibung', () => {
    const beiAenderung = vi.fn()
    render(
      <Haken beschriftung="Hallenmodus" angehakt={false} beiAenderung={beiAenderung} hinweis="Gilt erst nach dem Speichern." data-testid="halle" />,
    )
    const kasten = screen.getByRole('checkbox', { name: 'Hallenmodus' })
    expect(kasten).not.toBeChecked()
    expect(kasten).toHaveAccessibleDescription('Gilt erst nach dem Speichern.')
    fireEvent.click(kasten)
    expect(beiAenderung).toHaveBeenCalledWith(true)
  })

  test('nimmt waehrend des Sendens keine Aenderung an, bleibt aber fokussierbar', () => {
    const beiAenderung = vi.fn()
    render(<Haken beschriftung="Push" angehakt beiAenderung={beiAenderung} schreibgeschuetzt />)
    const kasten = screen.getByRole('checkbox', { name: 'Push' })
    fireEvent.click(kasten)
    expect(beiAenderung).not.toHaveBeenCalled()
    expect(kasten).not.toBeDisabled()
    expect(kasten).toHaveAttribute('aria-readonly', 'true')
  })
})
