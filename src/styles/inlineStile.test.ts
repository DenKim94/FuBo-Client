import { describe, expect, test } from 'vitest'

/**
 * Inline-Stile in React nennen CSS-Eigenschaften in camelCase (`backgroundColor`), nicht in der Schreibweise
 * von CSS (`background-color`). React warnt sonst in der Konsole („Unsupported style property“), und ob der Wert
 * ankommt, entscheidet der Browser, nicht React. Eigene Variablen (`'--fuellung-anteil'`) sind die Ausnahme:
 * Sie beginnen mit `--` und werden über `setProperty` gesetzt.
 *
 * Anlass: Konsolenfehler vom 24.10.2026 an „Abmelden“ (Kopfzeile) und „Ich kann nicht“/„Absagen“.
 */
const quellen = import.meta.glob<string>(['/src/**/*.tsx', '!/src/**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Ein Schlüssel in Anführungszeichen mit Bindestrich, der nicht mit `--` beginnt, in einem `style`-Objekt. */
const KEBAB_IN_STYLE = /style=\{\{[^}]*['"](?!--)[a-z]+-[a-z-]+['"]\s*:/

describe('Inline-Stile', () => {
  test('nennen CSS-Eigenschaften in camelCase', () => {
    const treffer = Object.entries(quellen)
      .filter(([, quelle]) => KEBAB_IN_STYLE.test(quelle))
      .map(([pfad]) => pfad)
    expect(treffer).toEqual([])
  })

  test('das Muster erkennt die Fehlerform und lässt eigene Variablen durch', () => {
    expect(KEBAB_IN_STYLE.test(`style={{ 'background-color': 'red' }}`)).toBe(true)
    expect(KEBAB_IN_STYLE.test(`style={{ backgroundColor: 'red' }}`)).toBe(false)
    expect(KEBAB_IN_STYLE.test(`style={{ '--fuellung-anteil': '50%' } as CSSProperties}`)).toBe(false)
  })

  test('die Prüfung findet die Komponenten überhaupt', () => {
    expect(Object.keys(quellen).length).toBeGreaterThan(50)
  })
})
