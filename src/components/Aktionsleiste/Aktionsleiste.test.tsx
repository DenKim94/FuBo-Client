import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
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

  describe('meldet ihre Hoehe (WCAG 2.4.11)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      document.documentElement.style.removeProperty('--aktionsleiste-ist')
    })

    /** Eine Attrappe, die den Rueckruf festhaelt: jsdom hat keinen `ResizeObserver`. */
    function beobachterEinsetzen() {
      const stand = { rueckruf: null as (() => void) | null, getrennt: false }
      class Attrappe {
        constructor(rueckruf: () => void) {
          stand.rueckruf = rueckruf
        }
        observe() {}
        disconnect() {
          stand.getrennt = true
        }
      }
      vi.stubGlobal('ResizeObserver', Attrappe)
      return stand
    }

    test('setzt --aktionsleiste-ist auf die Hoehe der Leiste, folgt Aenderungen und raeumt beim Abbau auf', () => {
      const stand = beobachterEinsetzen()
      let hoehe = 72
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => hoehe })
      try {
        const { unmount } = render(
          <Aktionsleiste>
            <button type="button">Zusagen</button>
          </Aktionsleiste>,
        )
        const wurzel = document.documentElement
        expect(wurzel.style.getPropertyValue('--aktionsleiste-ist')).toBe('72px')

        // Die Leiste waechst (etwa durch einen Grund unter dem Zaehler).
        hoehe = 120
        stand.rueckruf?.()
        expect(wurzel.style.getPropertyValue('--aktionsleiste-ist')).toBe('120px')

        unmount()
        expect(stand.getrennt).toBe(true)
        expect(wurzel.style.getPropertyValue('--aktionsleiste-ist')).toBe('')
      } finally {
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
      }
    })

    test('ohne ResizeObserver (aelterer Browser) bleibt die Leiste nutzbar und setzt nichts', () => {
      vi.stubGlobal('ResizeObserver', undefined)

      render(
        <Aktionsleiste>
          <button type="button">Zusagen</button>
        </Aktionsleiste>,
      )

      expect(screen.getByRole('button', { name: 'Zusagen' })).toBeInTheDocument()
      expect(document.documentElement.style.getPropertyValue('--aktionsleiste-ist')).toBe('')
    })
  })
})
