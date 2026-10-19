import { describe, expect, test } from 'vitest'

/**
 * Umrandungen von Karten, Listen und Hinweisen nutzen `--farbe-rand-bedienbar` (Vorgabe des Entwicklers vom
 * 19.10.2026: klarere Abgrenzung). `--farbe-rand` bleibt für Trennlinien innerhalb einer Karte, Kennzeichen und
 * gesperrte Schaltflächen; diese stehen nicht als ganzer Rahmen `border: 1px solid` in einer Datei.
 */
const stile = import.meta.glob<string>('/src/**/*.module.scss', { query: '?raw', import: 'default', eager: true })

/** Kennzeichen sind kleine Marken, keine Karten: Ein dunkler Rand liesse sie wie Schaltflächen wirken. */
const AUSNAHMEN = ['/src/components/ProfilKennzeichen/ProfilKennzeichen.module.scss', '/src/components/AdminTerminZeile/AdminTerminZeile.module.scss']

describe('Umrandungen', () => {
  test('ganze Rahmen von Karten und Listen nutzen die kräftige Randfarbe', () => {
    const blass = Object.entries(stile)
      .filter(([pfad]) => !AUSNAHMEN.includes(pfad))
      .filter(([, quelle]) => /border:\s*1px solid var\(--farbe-rand\)/.test(quelle))
      .map(([pfad]) => pfad)
    expect(blass).toEqual([])
  })

  test('die Prüfung findet die Stylesheets überhaupt', () => {
    expect(Object.keys(stile).length).toBeGreaterThan(20)
  })
})
