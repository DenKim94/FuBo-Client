import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { ergebnisErfassen } from '@/api/ergebnis/ergebnis'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'

/** Fängt Körper und Kopf der nächsten Erfassung ab. */
function erfassungAbfangen() {
  const gefangen: { koerper: unknown; kopf: string | null; aufrufe: number } = { koerper: null, kopf: 'nicht gelesen', aufrufe: 0 }
  mockServer.use(
    http.post('*/ergebnis/erfassen', async ({ request }) => {
      gefangen.aufrufe += 1
      gefangen.koerper = await request.json()
      gefangen.kopf = request.headers.get('X-FuBo-Kein-Refresh')
      return HttpResponse.json(
        { sieger: 'A', deutlich: true, erfasstVon: 'Beispielspieler 03', erfasstAm: '2099-01-13T21:00:00Z', korrigiertAm: null, version: 1 },
        { status: 201 },
      )
    }),
  )
  return gefangen
}

describe('ergebnisErfassen', () => {
  test('sendet Termin, Sieger und deutlich ohne Hintergrundkopf und liefert das Ergebnis', async () => {
    const gefangen = erfassungAbfangen()
    const ergebnis = await ergebnisErfassen(102, 'A', true)

    expect(gefangen.koerper).toEqual({ terminId: 102, sieger: 'A', deutlich: true })
    // Eine Bedienung zaehlt als Aktivitaet und verlaengert die Sitzung.
    expect(gefangen.kopf).toBeNull()
    expect(ergebnis.version).toBe(1)
    expect(ergebnis.erfasstVon).toBe('Beispielspieler 03')
  })

  test('sendet bei Unentschieden immer deutlich = false, auch wenn true uebergeben wird', async () => {
    // `true` bei `U` ist am Server unzulaessig (`400`); der Client schliesst den Fall aus.
    const gefangen = erfassungAbfangen()
    await ergebnisErfassen(102, 'U', true)
    expect(gefangen.koerper).toEqual({ terminId: 102, sieger: 'U', deutlich: false })
  })

  test('laesst deutlich = false bei einem Sieg unveraendert', async () => {
    const gefangen = erfassungAbfangen()
    await ergebnisErfassen(102, 'B', false)
    expect(gefangen.koerper).toEqual({ terminId: 102, sieger: 'B', deutlich: false })
  })

  test.each(['ERGEBNIS_VORHANDEN', 'TERMIN_NICHT_ABGESCHLOSSEN', 'KEINE_EINTEILUNG'] as const)(
    'uebersetzt 409 %s in einen ApiFehler mit Code',
    async (code) => {
      mockServer.use(http.post('*/ergebnis/erfassen', () => problem(409, code, 'Text des Servers.')))
      const fehler = await ergebnisErfassen(102, 'A', false).catch((f: unknown) => f)
      expect(fehler).toBeInstanceOf(ApiFehler)
      expect((fehler as ApiFehler).status).toBe(409)
      expect((fehler as ApiFehler).code).toBe(code)
    },
  )

  test('uebersetzt 404 in INHALT_NICHT_GEFUNDEN', async () => {
    mockServer.use(http.post('*/ergebnis/erfassen', () => problem(404, 'INHALT_NICHT_GEFUNDEN', 'Nicht gefunden.')))
    const fehler = await ergebnisErfassen(999, 'A', false).catch((f: unknown) => f)
    expect((fehler as ApiFehler).code).toBe('INHALT_NICHT_GEFUNDEN')
  })
})
