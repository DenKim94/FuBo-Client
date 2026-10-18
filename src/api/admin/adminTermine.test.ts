import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { serieAnlegen, terminAbsagen, terminAendern, terminAnlegen, terminEntfernen } from '@/api/admin/adminTermine'
import { mockServer } from '@/test/mocks/server'

/** Hält Methode, Körper und Kopf `X-FuBo-Kein-Refresh` eines Aufrufs fest. */
function aufzeichnen(pfad: string, status: number, antwort?: unknown) {
  const sicht: { methode?: string; rumpf?: unknown; kopf?: string | null } = {}
  mockServer.use(
    http.all(`*${pfad}`, async ({ request }) => {
      sicht.methode = request.method
      sicht.kopf = request.headers.get('X-FuBo-Kein-Refresh')
      sicht.rumpf = await request.json()
      return antwort === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(antwort, { status })
    }),
  )
  return sicht
}

describe('Terminverwaltung (API)', () => {
  test('terminAnlegen sendet Datum, Uhrzeit und Ort und liefert den Rumpf der 201', async () => {
    const sicht = aufzeichnen('/admin/termin/anlegen', 201, { terminId: 7, datum: '2099-03-02', uhrzeit: '20:00:00' })

    const angelegt = await terminAnlegen({ datum: '2099-03-02', uhrzeit: '20:00', ort: 'Beispielhalle' })

    expect(angelegt).toEqual({ terminId: 7, datum: '2099-03-02', uhrzeit: '20:00:00' })
    expect(sicht.methode).toBe('POST')
    expect(sicht.rumpf).toEqual({ datum: '2099-03-02', uhrzeit: '20:00', ort: 'Beispielhalle' })
    expect(sicht.kopf).toBeNull()
  })

  test('serieAnlegen liefert angelegte und übersprungene Zeitpunkte', async () => {
    const antwort = {
      serieId: 3,
      titel: 'Beispielserie',
      angelegteTermine: [{ terminId: 8, datum: '2099-03-03', uhrzeit: '20:00:00' }],
      uebersprungeneTermine: ['2099-03-10'],
    }
    const sicht = aufzeichnen('/admin/serie/anlegen', 201, antwort)
    const anfrage = {
      titel: 'Beispielserie',
      wochentag: 2,
      uhrzeit: '20:00',
      startdatum: '2099-03-01',
      enddatum: '2099-03-15',
    }

    await expect(serieAnlegen(anfrage)).resolves.toEqual(antwort)

    expect(sicht.rumpf).toEqual(anfrage)
    expect(sicht.kopf).toBeNull()
  })

  test('terminAendern sendet version und nur das Geänderte; "" leert den Ort', async () => {
    const sicht = aufzeichnen('/admin/termin/aendern', 204)

    await expect(terminAendern({ terminId: 5, version: 4, ort: '' })).resolves.toBeUndefined()

    expect(sicht.methode).toBe('POST')
    expect(sicht.rumpf).toEqual({ terminId: 5, version: 4, ort: '' })
    expect(sicht.kopf).toBeNull()
  })

  test('terminAbsagen und terminEntfernen senden nur die Id', async () => {
    const absagen = aufzeichnen('/admin/termin/absagen', 204)
    const entfernen = aufzeichnen('/admin/termin/entfernen', 204)

    await terminAbsagen(5)
    await terminEntfernen(6)

    expect(absagen.rumpf).toEqual({ terminId: 5 })
    expect(entfernen.rumpf).toEqual({ terminId: 6 })
    expect(absagen.kopf).toBeNull()
    expect(entfernen.kopf).toBeNull()
  })
})
