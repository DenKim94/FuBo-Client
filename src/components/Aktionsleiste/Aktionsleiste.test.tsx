import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Aktionsleiste from './Aktionsleiste'

/**
 * Die Leiste hat bis C3 keine Ansicht, die sie einbindet. Dieser Test haelt sie
 * trotzdem in Betrieb: Er sichert die `data-testid`, an der die E2E-Pruefung des
 * Safe-Area-Verbrauchs haengt, und dass die uebergebene Aktion tatsaechlich in
 * der Leiste landet und nicht daneben.
 */
describe('Aktionsleiste', () => {
  test('zeigt die uebergebene Aktion innerhalb der Leiste', () => {
    render(
      <Aktionsleiste>
        <button type="button">Zusagen</button>
      </Aktionsleiste>,
    )

    const leiste = screen.getByTestId('aktionsleiste')
    expect(leiste).toContainElement(screen.getByRole('button', { name: 'Zusagen' }))
  })
})
