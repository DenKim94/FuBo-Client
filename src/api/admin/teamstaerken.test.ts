import { describe, expect, test } from 'vitest'
import type { SkillKategorie } from '@/api/admin/skills'
import { teamstaerkenZeilen } from '@/api/admin/teamstaerken'

/** Erfundene Kategorien: Die Komponente darf keine Kategorie beim Namen kennen. */
const KATEGORIEN: SkillKategorie[] = [
  { schluessel: 'TEMPO', bezeichnung: 'Tempo', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 6 },
  { schluessel: 'TECHNIK', bezeichnung: 'Technik', gewicht: 1, reihenfolge: 2, minWert: 0, maxWert: 6 },
  { schluessel: 'HALTEN', bezeichnung: 'Halten', gewicht: 0.3, reihenfolge: 3, minWert: 0, maxWert: 3 },
]

describe('teamstaerkenZeilen', () => {
  test('Reihenfolge und Beschriftung kommen aus den Kategorien, nicht aus der Antwort', () => {
    const zeilen = teamstaerkenZeilen({ HALTEN: 1, TECHNIK: 7, TEMPO: 9 }, { TEMPO: 8, HALTEN: 0, TECHNIK: 6 }, KATEGORIEN)

    expect(zeilen).toEqual([
      { schluessel: 'TEMPO', bezeichnung: 'Tempo', a: 9, b: 8 },
      { schluessel: 'TECHNIK', bezeichnung: 'Technik', a: 7, b: 6 },
      { schluessel: 'HALTEN', bezeichnung: 'Halten', a: 1, b: 0 },
    ])
  })

  test('eine nur gelieferte Kategorie steht hinten mit ihrem Schlüssel; eine nicht gelieferte entfällt; ein fehlender Wert ist 0', () => {
    const zeilen = teamstaerkenZeilen({ TEMPO: 4, NEU: 2 }, { TEMPO: 5 }, KATEGORIEN)

    expect(zeilen).toEqual([
      { schluessel: 'TEMPO', bezeichnung: 'Tempo', a: 4, b: 5 },
      { schluessel: 'NEU', bezeichnung: 'NEU', a: 2, b: 0 },
    ])
  })

  test('ohne geladene Kategorien gilt die Reihenfolge der Antwort', () => {
    expect(teamstaerkenZeilen({ B: 1, A: 2 }, { B: 3, A: 4 }, undefined).map((z) => z.schluessel)).toEqual(['B', 'A'])
  })
})
