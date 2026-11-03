import { describe, expect, test } from 'vitest'
import { REGELN, regelText } from './konfigurationText'

describe('konfigurationText – Wahl des Springers', () => {
  test('bietet genau die Werte des Vertrags an (seit 03.11.2026 ohne SCHWAECHSTER_UEBERZAHL)', () => {
    expect(REGELN.map((r) => r.wert)).toEqual(['ZUFAELLIG', 'ZULETZT_ANGEMELDET'])
  })

  test('formuliert die Regeln ohne Bezug auf ein Team, denn der Springer gehört keinem fest an', () => {
    expect(regelText('ZUFAELLIG')).toBe('Zufällig aus allen Teilnehmern')
    expect(regelText('ZULETZT_ANGEMELDET')).toBe('Zuletzt angemeldeter Spieler mit der spätesten Zusage')
    expect(REGELN.map((r) => `${r.text} ${r.zusatz}`).join(' ')).not.toMatch(/Team|schwäch|Auswechsel/i)
  })
})
