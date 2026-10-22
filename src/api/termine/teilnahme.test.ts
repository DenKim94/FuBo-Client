import { describe, expect, test } from 'vitest'
import { detailsVon, terminModell } from '@/test/mocks/termine'
import { spieltMit } from './teilnahme'

const ICH = 'Beispielspieler 01'

/** Ein Termin mit Höchstzahl 2: Der dritte Eintrag wartet. */
function termin(zusagen: { name: string; gast: boolean }[], eigene: boolean | null) {
  return detailsVon(terminModell({ terminId: 1, max: 2, min: 1, zusagen, eigene }))
}

describe('spieltMit', () => {
  test('zugesagt und innerhalb der Höchstzahl: spielt mit', () => {
    expect(spieltMit(termin([{ name: ICH, gast: false }], true), ICH, false)).toBe(true)
  })

  test('auf der Warteschlange: spielt nicht mit', () => {
    const t = termin(
      [
        { name: 'Beispielspieler 11', gast: false },
        { name: 'Beispielspieler 12', gast: false },
        { name: ICH, gast: false },
      ],
      true,
    )
    expect(spieltMit(t, ICH, false)).toBe(false)
  })

  test('abgesagt oder noch nicht gemeldet: spielt nicht mit', () => {
    expect(spieltMit(termin([{ name: 'Beispielspieler 11', gast: false }], false), ICH, false)).toBe(false)
    expect(spieltMit(termin([{ name: 'Beispielspieler 11', gast: false }], null), ICH, false)).toBe(false)
  })

  test('ein Gast gleichen Namens ist nicht der eigene Eintrag', () => {
    expect(spieltMit(termin([{ name: ICH, gast: true }], true), ICH, false)).toBe(false)
    expect(spieltMit(termin([{ name: ICH, gast: true }], true), ICH, true)).toBe(true)
  })

  test('ohne Anzeigenamen (Sitzung noch nicht geladen): spielt nicht mit', () => {
    expect(spieltMit(termin([{ name: ICH, gast: false }], true), undefined, false)).toBe(false)
  })
})
