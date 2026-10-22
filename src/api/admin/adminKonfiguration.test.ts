import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { gaesteFreigeben, gastplaetzeLesen, konfigurationAendern, konfigurationLesen } from '@/api/admin/adminKonfiguration'
import { gastStufeAendern } from '@/api/admin/adminTermine'
import { beispielGastplaetze, beispielKonfiguration } from '@/test/mocks/admin'
import { mockServer } from '@/test/mocks/server'

/** Hält Methode, Körper und Kopf `X-FuBo-Kein-Refresh` eines Aufrufs fest. */
function aufzeichnen(pfad: string, status: number, antwort?: unknown) {
  const sicht: { methode?: string; rumpf?: unknown; kopf?: string | null } = {}
  mockServer.use(
    http.all(`*${pfad}`, async ({ request }) => {
      sicht.methode = request.method
      sicht.kopf = request.headers.get('X-FuBo-Kein-Refresh')
      sicht.rumpf = request.method === 'GET' ? undefined : await request.json()
      return antwort === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(antwort, { status })
    }),
  )
  return sicht
}

describe('Konfiguration und Gastplätze (API)', () => {
  test('konfigurationLesen liest per GET, ohne Kopf X-FuBo-Kein-Refresh', async () => {
    const stand = { ...beispielKonfiguration(), halleAbsageVorlageEffektiv: 'Text' }
    const sicht = aufzeichnen('/admin/config/lesen', 200, stand)

    await expect(konfigurationLesen()).resolves.toEqual(stand)

    expect(sicht.methode).toBe('GET')
    expect(sicht.kopf).toBeNull()
  })

  test('konfigurationAendern sendet den Körper unverändert per POST, ohne Kopf, und liefert nichts', async () => {
    const sicht = aufzeichnen('/admin/config/aendern', 204)
    const anfrage = { ...beispielKonfiguration(), geaendertAm: undefined }
    delete anfrage.geaendertAm

    await expect(konfigurationAendern(anfrage)).resolves.toBeUndefined()

    expect(sicht.methode).toBe('POST')
    expect(sicht.rumpf).toEqual(anfrage)
    expect(sicht.kopf).toBeNull()
  })

  test('gastplaetzeLesen liest per GET, ohne Kopf', async () => {
    const sicht = aufzeichnen('/admin/gast/lesen', 200, beispielGastplaetze())

    await expect(gastplaetzeLesen()).resolves.toHaveLength(4)

    expect(sicht.methode).toBe('GET')
    expect(sicht.kopf).toBeNull()
  })

  test('gaesteFreigeben sendet genau slotIds oder genau alle', async () => {
    const sicht = aufzeichnen('/admin/gast/freigeben', 204)

    await gaesteFreigeben({ slotIds: [2, 5] })
    expect(sicht.rumpf).toEqual({ slotIds: [2, 5] })

    await gaesteFreigeben({ alle: true })
    expect(sicht.rumpf).toEqual({ alle: true })
    expect(sicht.kopf).toBeNull()
  })

  test('gastStufeAendern sendet den Namen unverändert (Leerraum und Schreibweise bleiben)', async () => {
    const sicht = aufzeichnen('/admin/teilnahme/gast-stufe', 204)

    await expect(gastStufeAendern({ terminId: 7, gastName: ' Beispielgast  ', stufe: 'STARK' })).resolves.toBeUndefined()

    expect(sicht.methode).toBe('POST')
    expect(sicht.rumpf).toEqual({ terminId: 7, gastName: ' Beispielgast  ', stufe: 'STARK' })
    expect(sicht.kopf).toBeNull()
  })
})
