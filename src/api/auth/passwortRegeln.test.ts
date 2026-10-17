import { describe, expect, test } from 'vitest'
import { PASSWORT_MAX_LAENGE, PASSWORT_MIN_LAENGE, neuesPasswortGueltig } from './passwortRegeln'

describe('neuesPasswortGueltig', () => {
  test('nennt die Grenzen des Kontrakts', () => {
    expect(PASSWORT_MIN_LAENGE).toBe(10)
    expect(PASSWORT_MAX_LAENGE).toBe(72)
  })

  test.each([
    [9, false],
    [10, true],
    [72, true],
    [73, false],
  ])('bewertet ein Passwort mit %i Zeichen als %s', (laenge, erwartet) => {
    expect(neuesPasswortGueltig('a'.repeat(laenge))).toBe(erwartet)
  })

  test('verlangt keine Zeichenklassen', () => {
    // Laenge traegt mehr als erzwungene Sonderzeichen (Kontrakt).
    expect(neuesPasswortGueltig('nurkleinbuchstaben')).toBe(true)
  })

  test('zaehlt Leerzeichen am Rand mit und trimmt nicht', () => {
    expect(neuesPasswortGueltig('         a')).toBe(true)
  })
})
