import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { bilanzLesen } from '@/api/bilanz/bilanz'
import { beispielBilanz } from '@/test/mocks/termine'
import { mockServer } from '@/test/mocks/server'

function abfangen() {
  const gefangen: { kopf: string | null } = { kopf: 'nicht gelesen' }
  mockServer.use(
    http.get('*/bilanz/lesen', ({ request }) => {
      gefangen.kopf = request.headers.get('X-FuBo-Kein-Refresh')
      return HttpResponse.json({ siege: 3, niederlagen: 2, unentschieden: 1 })
    }),
  )
  return gefangen
}

describe('bilanzLesen', () => {
  test('liefert die drei Zaehler', async () => {
    await expect(bilanzLesen()).resolves.toEqual(beispielBilanz)
  })

  test('liest ohne Hintergrundkopf, solange niemand ihn verlangt', async () => {
    const gefangen = abfangen()
    await bilanzLesen()
    expect(gefangen.kopf).toBeNull()
  })

  test('traegt den Kopf auf Wunsch', async () => {
    const gefangen = abfangen()
    await bilanzLesen(true)
    expect(gefangen.kopf).toBe('true')
  })
})
