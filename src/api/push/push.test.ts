import { describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import {
  pushAboAnlegen,
  pushAboEntfernen,
  pushEinstellungAendern,
  pushProbeversand,
  pushSchluesselLesen,
  pushStatusLesen,
} from '@/api/push/push'
import { BEISPIEL_VAPID, pushHandler, pushWelt } from '@/test/mocks/push'
import { mockServer } from '@/test/mocks/server'

/** Ein Endpunkt mit Großbuchstaben und ohne abschließenden Schrägstrich: Jede Bearbeitung fiele auf (P8, G7). */
const ENDPUNKT = 'https://Push.Example/Send/AbC-123_xYz'
const ABO = { endpoint: ENDPUNKT, p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) }

function welt(...args: Parameters<typeof pushWelt>) {
  const w = pushWelt(...args)
  mockServer.use(...pushHandler(w))
  return w
}

describe('Push-Datenzugriff', () => {
  test('liest den Schlüssel', async () => {
    welt()
    await expect(pushSchluesselLesen()).resolves.toEqual({ vapidPublicKey: BEISPIEL_VAPID })
  })

  test('meldet 503 PUSH_NICHT_KONFIGURIERT als ApiFehler', async () => {
    welt({ eingerichtet: false })
    const fehler = await pushSchluesselLesen().catch((f: unknown) => f)
    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).status).toBe(503)
    expect((fehler as ApiFehler).code).toBe('PUSH_NICHT_KONFIGURIERT')
  })

  test('liest den Status', async () => {
    welt({ anlageAktiv: false, pushErwuenscht: true })
    await expect(pushStatusLesen()).resolves.toEqual({ anlageAktiv: false, pushErwuenscht: true })
  })

  test('setzt den Personenschalter und liefert den gespeicherten Stand', async () => {
    const w = welt()
    await expect(pushEinstellungAendern(false)).resolves.toEqual({ pushErwuenscht: false })
    expect(w.pushErwuenscht).toBe(false)
  })

  test('sendet das Abonnement unverändert und ohne Hintergrundkopf', async () => {
    const w = welt()
    await expect(pushAboAnlegen(ABO)).resolves.toEqual({ aboVorhanden: true })
    expect(w.letzterAboKoerper).toEqual(ABO)
    expect(w.letzterAboKoerper?.endpoint).toBe(ENDPUNKT)
    expect(w.anlegenKoepfe).toEqual([null])
  })

  test('setzt X-FuBo-Kein-Refresh für den Start-Abgleich', async () => {
    const w = welt()
    await pushAboAnlegen(ABO, true)
    expect(w.anlegenKoepfe).toEqual(['true'])
  })

  test('entfernt das Abonnement über die Adresse', async () => {
    const w = welt({ endpunkte: new Set([ENDPUNKT]) })
    await expect(pushAboEntfernen(ENDPUNKT)).resolves.toEqual({ aboVorhanden: false })
    expect(w.endpunkte.size).toBe(0)
  })

  test('Probeversand geht ohne Körper und ohne Content-Type hinaus', async () => {
    const w = welt({ rolle: 'ADMIN', endpunkte: new Set([ENDPUNKT]) })
    await expect(pushProbeversand()).resolves.toEqual({ empfaenger: 1, zugestellt: 1 })
    expect(w.probeInhaltstyp).toBeNull()
    expect(w.probeKoerper).toBe('')
  })
})
