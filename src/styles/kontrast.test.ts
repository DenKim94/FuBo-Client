import { describe, expect, test } from 'vitest'
import quelle from './_globalVars.scss?raw'

/**
 * Kontraste der Farb-Tokens in **beiden** Modi (Dark-Mode seit 31.10.2026) nach WCAG 2.1 AA.
 *
 * Gerechnet wird aus der Token-Datei selbst: Ein neuer oder geänderter Wert, der eine Grenze reisst, macht diesen Test
 * rot, bevor ihn jemand auf dem Telefon bemerkt. Grenzen: Text 4.5:1 (1.4.3), Ränder, Symbole und Fokus 3:1 (1.4.11).
 */

type Tokens = Record<string, string>

/** Liest alle `--farbe-*: #hex` aus einem Textstück. Werte über `var()` folgen ihrem Ziel und brauchen keinen Eintrag. */
function farben(text: string): Tokens {
  const ergebnis: Tokens = {}
  for (const [, name, wert] of text.matchAll(/--(farbe-[a-z-]+):\s*(#[0-9a-fA-F]{6,8})\b/g)) ergebnis[name] = wert
  return ergebnis
}

const anfangDunkel = quelle.indexOf('@media (prefers-color-scheme: dark)')
const anfangBackdrop = quelle.indexOf('::backdrop')
const HELL = farben(quelle.slice(0, anfangBackdrop))
const DUNKEL: Tokens = { ...HELL, ...farben(quelle.slice(anfangDunkel)) }

/** Relative Leuchtdichte nach WCAG. */
function leuchtdichte(hex: string): number {
  const kanal = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * kanal(0) + 0.7152 * kanal(1) + 0.0722 * kanal(2)
}

function kontrast(a: string, b: string): number {
  const [hell, dunkel] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x)
  return (hell + 0.05) / (dunkel + 0.05)
}

/** Vordergrund, Hintergrund, Mindestwert. Abgeleitet aus der tatsächlichen Verwendung in den Komponenten. */
const PAARE: [string, string, number][] = [
  ['farbe-text', 'farbe-hintergrund', 4.5],
  ['farbe-text', 'farbe-flaeche', 4.5],
  ['farbe-text', 'farbe-flaeche-kraeftig', 4.5],
  ['farbe-text', 'farbe-fehler-flaeche', 4.5],
  ['farbe-text', 'farbe-hinweis-flaeche', 4.5],
  ['farbe-text-schwach', 'farbe-hintergrund', 4.5],
  ['farbe-text-schwach', 'farbe-flaeche', 4.5],
  ['farbe-text-schwach', 'farbe-primaer-flaeche', 4.5],
  // Schrift auf Schaltflächen, gewählten Segmenten, dem Aktualisierungshinweis.
  ['farbe-primaer-kontrast', 'farbe-primaer', 4.5],
  ['farbe-primaer-kontrast', 'farbe-primaer-dunkel', 4.5],
  ['farbe-primaer-kontrast', 'farbe-link', 4.5],
  ['farbe-primaer-kontrast', 'farbe-fehler', 4.5],
  ['farbe-link', 'farbe-hintergrund', 4.5],
  ['farbe-link', 'farbe-flaeche', 4.5],
  ['farbe-link', 'farbe-link-flaeche', 4.5],
  ['farbe-fehler', 'farbe-hintergrund', 4.5],
  ['farbe-fehler', 'farbe-fehler-flaeche', 4.5],
  ['farbe-hinweis', 'farbe-hintergrund', 4.5],
  ['farbe-hinweis', 'farbe-hinweis-flaeche', 4.5],
  // Symbole, Balken, Tab-Markierung, Schalterspur.
  ['farbe-primaer', 'farbe-hintergrund', 3],
  ['farbe-primaer', 'farbe-primaer-flaeche', 3],
  ['farbe-erfolg', 'farbe-hintergrund', 3],
  ['farbe-erfolg', 'farbe-flaeche-kraeftig', 3],
  ['farbe-fehler', 'farbe-flaeche-kraeftig', 3],
  ['farbe-rand-bedienbar', 'farbe-hintergrund', 3],
  ['farbe-rand-bedienbar', 'farbe-flaeche', 3],
  // Knopf des ausgeschalteten Schalters auf seiner Spur.
  ['farbe-rand-bedienbar', 'farbe-flaeche-kraeftig', 3],
  ['farbe-fokus', 'farbe-hintergrund', 3],
  ['farbe-fokus', 'farbe-flaeche', 3],
]

describe.each([
  ['hell', HELL],
  ['dunkel', DUNKEL],
])('Kontraste im Modus %s', (_modus, tokens) => {
  test.each(PAARE)('%s auf %s mindestens %d:1', (vorne, hinten, minimum) => {
    expect(tokens[vorne], vorne).toBeDefined()
    expect(tokens[hinten], hinten).toBeDefined()
    expect(kontrast(tokens[vorne], tokens[hinten])).toBeGreaterThanOrEqual(minimum)
  })
})

describe('Dark-Mode', () => {
  test('jedes helle Farb-Token hat einen dunklen Wert', () => {
    const dunkelEigen = farben(quelle.slice(anfangDunkel))
    const ohne = Object.keys(HELL).filter((name) => !(name in dunkelEigen))
    expect(ohne).toEqual([])
  })

  test('die Seite meldet beide Modi (sonst dunkelt Chrome sie selbst ab)', () => {
    expect(quelle).toMatch(/color-scheme:\s*light dark/)
  })

  test('die Prüfung findet die Tokens überhaupt', () => {
    expect(Object.keys(HELL).length).toBeGreaterThan(15)
    expect(anfangDunkel).toBeGreaterThan(0)
  })
})
