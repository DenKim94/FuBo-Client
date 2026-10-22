import { describe, expect, test } from 'vitest'
import { detailsVon, teamsAus, terminModell } from '@/test/mocks/termine'
import { istEingeteilt, spieltMit } from './teilnahme'

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

describe('istEingeteilt', () => {
  /** Einteilung aus drei Zusagen bei Höchstzahl 2: Der dritte (Warteschlange) ist nicht eingeteilt. */
  const teams = teamsAus(
    terminModell({
      terminId: 1,
      max: 2,
      zusagen: [
        { name: ICH, gast: false },
        { name: 'Beispielgast', gast: true },
        { name: 'Beispielspieler 13', gast: false },
      ],
    }),
  )

  test('steht in Team A oder B (auch als Auswechselspieler): eingeteilt', () => {
    expect(istEingeteilt(teams, ICH, false)).toBe(true)
    expect(istEingeteilt(teams, 'Beispielgast', true)).toBe(true)
  })

  test('auf der Warteschlange oder gar nicht dabei: nicht eingeteilt', () => {
    expect(istEingeteilt(teams, 'Beispielspieler 13', false)).toBe(false)
    expect(istEingeteilt(teams, 'Beispielspieler 99', false)).toBe(false)
  })

  test('Name und Gast-Kennzeichen müssen passen', () => {
    expect(istEingeteilt(teams, ICH, true)).toBe(false)
    expect(istEingeteilt(teams, 'Beispielgast', false)).toBe(false)
  })

  test('ohne Einteilung oder ohne Namen: nicht eingeteilt', () => {
    expect(istEingeteilt(null, ICH, false)).toBe(false)
    expect(istEingeteilt(teams, undefined, false)).toBe(false)
  })
})
