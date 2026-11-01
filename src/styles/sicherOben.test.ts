import { describe, expect, test } from 'vitest'
import quelle from './_globalVars.scss?raw'

/**
 * Oberer Rand der installierten App auf iOS (01.11.2026, dritter Anlauf).
 *
 * Die Wirkung misst `e2e/dunkel.spec.ts` im Browser (Attribut `data-ios-app` gesetzt). Hier steht die Regel, an der
 * zwei Versuche scheiterten: Die Luft der iOS-App darf **nicht** vom gemeldeten Einzug abhängen – ohne
 * `apple-mobile-web-app-status-bar-style` meldet iOS 0, und `min(0, …)` ist 0.
 */
describe('--sicher-oben-kopf', () => {
  const block = /:root\[data-ios-app\]\s*\{([^}]*)\}/.exec(quelle)

  test('die iOS-App hat einen eigenen Wert', () => {
    expect(block, 'Block :root[data-ios-app] fehlt').not.toBeNull()
  })

  test('feste Luft von mindestens 2.5rem, ohne min() am Einzug', () => {
    const wert = /--sicher-oben-kopf:\s*calc\(var\(--sicher-oben\) \+ ([\d.]+)rem\);/.exec(block![1])
    expect(wert, 'Formel Einzug + x rem').not.toBeNull()
    // 2.5rem = 40px: die gemessene Reichweite der Unschärfe (38–40pt).
    expect(Number(wert![1])).toBeGreaterThanOrEqual(2.5)
    expect(block![1]).not.toMatch(/min\(/)
  })
})
