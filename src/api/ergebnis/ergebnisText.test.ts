import { describe, expect, test } from 'vitest'
import { ergebnisSatz } from '@/api/ergebnis/ergebnisText'

describe('ergebnisSatz', () => {
  test.each([
    ['A', false, 'Team A hat gewonnen.'],
    ['A', true, 'Team A hat deutlich gewonnen.'],
    ['B', false, 'Team B hat gewonnen.'],
    ['B', true, 'Team B hat deutlich gewonnen.'],
    ['U', false, 'Unentschieden.'],
  ] as const)('%s, deutlich %s: %s', (sieger, deutlich, erwartet) => {
    expect(ergebnisSatz(sieger, deutlich)).toBe(erwartet)
  })

  test('ignoriert deutlich bei Unentschieden', () => {
    expect(ergebnisSatz('U', true)).toBe('Unentschieden.')
  })
})
