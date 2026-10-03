import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { mockServer } from './mocks/server'

/**
 * Ergänzt jsdom um die fehlenden Methoden von `<dialog>`.
 *
 * jsdom kennt `HTMLDialogElement`, implementiert aber weder `showModal` noch
 * `close`. Der Stub bildet nur das nach, worauf die Komponente sich verlässt:
 * das Attribut `open` und das Ereignis `close`. Fokusfalle, Inertisierung und
 * `::backdrop` gibt es hier nicht – sie gehören in einen Playwright-Test.
 * Bringt eine spätere jsdom-Fassung die Methoden mit, greift der Stub nicht.
 */
function dialogStubEinrichten() {
  const proto = globalThis.HTMLDialogElement?.prototype
  if (!proto || typeof proto.showModal === 'function') return
  proto.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  proto.show = function (this: HTMLDialogElement) {
    this.open = true
  }
  proto.close = function (this: HTMLDialogElement, rueckgabe?: string) {
    if (!this.open) return
    this.open = false
    if (rueckgabe !== undefined) this.returnValue = rueckgabe
    this.dispatchEvent(new Event('close'))
  }
}

beforeAll(() => dialogStubEinrichten())

// `error` statt `warn`: Eine nicht abgedeckte Anfrage ist eine Luecke im Test
// und keine Nebensaechlichkeit – sie faellt sonst erst im Betrieb auf.
beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }))

// Nach jedem Test den gerenderten Baum abraeumen und die Handler zuruecksetzen,
// damit Tests einander nicht sehen.
afterEach(() => {
  cleanup()
  mockServer.resetHandlers()
})

afterAll(() => mockServer.close())
