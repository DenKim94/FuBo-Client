import { describe, expect, test } from 'vitest'
import { detailsVon, teamsAus, terminModell } from '@/test/mocks/termine'
import { einteilungVeraltet, istEingeteilt, spieltMit } from './teilnahme'

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

  test('steht in Team A oder B (auch als Springer): eingeteilt', () => {
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

describe('einteilungVeraltet (07.11.2026: nur geänderte Zusagen zählen)', () => {
  const A = { name: 'Beispielspieler 11', gast: false }
  const B = { name: 'Beispielspieler 12', gast: false }
  const C = { name: 'Beispielspieler 13', gast: false }
  const GAST = { name: 'Beispielgast 1', gast: true }

  /** Einteilung aus `eingeteilt`, Zusagen `zusagen`; der Server meldet `veraltet` wie angegeben. */
  function lage(eingeteilt: { name: string; gast: boolean }[], zusagen: { name: string; gast: boolean }[], veraltet = true, max = 10) {
    const details = detailsVon(terminModell({ terminId: 1, max, min: 1, zusagen, eigene: null }))
    const eintrag = (z: { name: string; gast: boolean }) => ({ anzeigeName: z.name, gast: z.gast, auswechselspieler: false })
    const haelfte = Math.ceil(eingeteilt.length / 2)
    return {
      ...details,
      teams: {
        erzeugtAm: '2026-11-07T08:15:00+01:00',
        erzeugtVon: A.name,
        veraltet,
        teamA: eingeteilt.slice(0, haelfte).map(eintrag),
        teamB: eingeteilt.slice(haelfte).map(eintrag),
      },
    }
  }

  test('Server meldet veraltet, Besetzung gleich (etwa eine Absage ohne vorherige Zusage): nicht veraltet', () => {
    expect(einteilungVeraltet(lage([A, B, GAST], [GAST, B, A]))).toBe(false)
  })

  test('eine Zusage weniger oder mehr: veraltet', () => {
    expect(einteilungVeraltet(lage([A, B, C], [A, B]))).toBe(true)
    expect(einteilungVeraltet(lage([A, B], [A, B, C]))).toBe(true)
  })

  test('gleich viele, aber eine andere Person: veraltet', () => {
    expect(einteilungVeraltet(lage([A, B], [A, C]))).toBe(true)
  })

  test('Gast-Kennzeichen zählt mit: ein Profil, das so heißt wie der Gast, ist eine andere Person', () => {
    expect(einteilungVeraltet(lage([GAST], [{ name: GAST.name, gast: false }]))).toBe(true)
  })

  test('Mehrfachvorkommen zählen: zwei gleichnamige Gäste sind nicht einer', () => {
    expect(einteilungVeraltet(lage([GAST, GAST, A], [GAST, A, A]))).toBe(true)
    expect(einteilungVeraltet(lage([GAST, GAST, A], [GAST, A, GAST]))).toBe(false)
  })

  test('die Warteschlange zählt nicht: ein neuer Wartender ändert die Besetzung nicht', () => {
    expect(einteilungVeraltet(lage([A, B], [A, B, C], true, 2))).toBe(false)
  })

  test('meldet der Server nicht veraltet, bleibt es dabei; ohne Einteilung nie veraltet', () => {
    expect(einteilungVeraltet(lage([A, B], [A, C], false))).toBe(false)
    expect(einteilungVeraltet({ ...lage([A], [A]), teams: null })).toBe(false)
  })
})
