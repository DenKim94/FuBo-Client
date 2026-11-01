import { describe, expect, test } from 'vitest'
import quelle from './_globalVars.scss?raw'

/**
 * Oberer Rand der installierten App auf iOS (01.11.2026).
 *
 * Seit iOS 26 liegt in einer Web-App vom Home-Bildschirm eine Unschaerfe des Systems rund 38–40pt unter dem Einzug.
 * Weder Chromium noch jsdom kennen `display-mode: standalone` mit `-webkit-touch-callout`; ein Browsertest kann die
 * Regel deshalb nicht auslösen. Geprüft wird die Quelle: Die Bedingung steht, und sie gibt mehr Luft als die 16px des
 * Browsers. Ob es auf dem Gerät reicht, zeigt nur das Gerät.
 */
describe('--sicher-oben-kopf', () => {
  const block = /@media \(display-mode: standalone\)\s*\{\s*@supports \(-webkit-touch-callout: none\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(
    quelle,
  )

  test('im Browser: Einzug plus höchstens 16px (--abstand-m)', () => {
    expect(quelle).toMatch(
      /--sicher-oben-kopf: calc\(var\(--sicher-oben\) \+ min\(var\(--sicher-oben\), var\(--abstand-m\)\)\);/,
    )
  })

  test('installierte App auf iOS: eigener Wert unterhalb der Unschärfe, 0 ohne Einzug', () => {
    expect(block, 'Block für display-mode: standalone und iOS fehlt').not.toBeNull()
    const wert = /--sicher-oben-kopf: calc\(var\(--sicher-oben\) \+ min\(var\(--sicher-oben\), ([\d.]+)rem\)\);/.exec(
      block![1],
    )
    expect(wert, 'Formel Einzug + min(Einzug, x rem)').not.toBeNull()
    // Mindestens 2.5rem = 40px: die gemessene Reichweite der Unschärfe (38–40pt).
    expect(Number(wert![1])).toBeGreaterThanOrEqual(2.5)
  })
})
