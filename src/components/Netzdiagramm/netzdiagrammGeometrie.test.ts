import { describe, expect, test } from 'vitest'
import { MITTE, RADIUS, anteil, ausrichtung, punkt, ringzahl, versatz, vieleck, winkel } from './netzdiagrammGeometrie'

describe('winkel und punkt', () => {
  test('die erste Achse zeigt nach oben', () => {
    expect(winkel(0, 5)).toBeCloseTo(-Math.PI / 2)
    const oben = punkt(0, 5, RADIUS)
    expect(oben.x).toBeCloseTo(MITTE.x)
    expect(oben.y).toBeCloseTo(MITTE.y - RADIUS)
  })

  test('die Achsen folgen im Uhrzeigersinn: bei vier Achsen zeigt die zweite nach rechts', () => {
    const rechts = punkt(1, 4, 50)
    expect(rechts.x).toBeCloseTo(MITTE.x + 50)
    expect(rechts.y).toBeCloseTo(MITTE.y)
  })

  test('Abstand 0 ist der Mittelpunkt', () => {
    expect(punkt(3, 5, 0)).toEqual(MITTE)
  })
})

describe('anteil', () => {
  test('liegt zwischen 0 und 1', () => {
    expect(anteil(0, 0, 6)).toBe(0)
    expect(anteil(3, 0, 6)).toBe(0.5)
    expect(anteil(6, 0, 6)).toBe(1)
  })

  test('rechnet ab der unteren Grenze', () => {
    expect(anteil(2, 1, 3)).toBe(0.5)
  })

  test('begrenzt Werte ausserhalb des Bereichs', () => {
    expect(anteil(9, 0, 6)).toBe(1)
    expect(anteil(-2, 0, 6)).toBe(0)
  })

  test('ein fehlender Wert liegt im Mittelpunkt', () => {
    expect(anteil(undefined, 0, 6)).toBe(0)
  })

  test('ein Bereich ohne Spanne gilt als voll', () => {
    expect(anteil(2, 2, 2)).toBe(1)
  })
})

describe('ringzahl', () => {
  test('je Wertstufe ein Ring, höchstens sechs', () => {
    expect(ringzahl(3)).toBe(3)
    expect(ringzahl(6)).toBe(6)
  })

  test('bei grösserer Spanne vier Ringe', () => {
    expect(ringzahl(10)).toBe(4)
  })

  test('ohne Spanne ein Ring', () => {
    expect(ringzahl(0)).toBe(1)
  })
})

describe('vieleck', () => {
  test('schreibt ein Paar je Achse mit einer Nachkommastelle', () => {
    const punkte = vieleck([RADIUS, RADIUS, RADIUS]).split(' ')
    expect(punkte).toHaveLength(3)
    for (const p of punkte) expect(p).toMatch(/^\d+\.\d,\d+\.\d$/)
  })

  test('Abstand 0 an jeder Ecke ergibt dreimal den Mittelpunkt', () => {
    expect(vieleck([0, 0, 0])).toBe('160.0,142.0 160.0,142.0 160.0,142.0')
  })
})

describe('Beschriftung', () => {
  test('rechts der Mitte linksbündig, links rechtsbündig, oben zentriert', () => {
    expect(ausrichtung(0, 5)).toBe('middle')
    expect(ausrichtung(1, 5)).toBe('start')
    expect(ausrichtung(4, 5)).toBe('end')
  })

  test('oben steht die Beschriftung über der Ecke, unten darunter', () => {
    expect(versatz(0, 5)).toBeLessThan(0)
    expect(versatz(2, 5)).toBeGreaterThan(0)
  })

  test('seitlich mit leichtem Versatz nach oben', () => {
    expect(versatz(1, 4)).toBe(-6)
  })
})
