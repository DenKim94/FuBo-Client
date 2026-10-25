import { HttpResponse, http } from 'msw'
import type { AboAnlegen } from '@/api/push/push'
import { problem } from './problem'

/** Beispielschlüssel aus dem Vertrag: unkomprimierter P-256-Punkt, base64url ohne Polsterung, 87 Zeichen (P7). */
export const BEISPIEL_VAPID = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'

/** Zweiter, anderer Schlüssel für Tests des Schlüsselwechsels. */
export const ANDERER_VAPID = `B${'Q'.repeat(86)}`

/** Aufrufe, die die Welt zählt. */
export type PushAufruf = 'schluessel' | 'status' | 'einstellung' | 'anlegen' | 'entfernen' | 'probe'

/**
 * Zustand des nachgebildeten Push-Servers. Zustandsbehaftet wie `adminWelt`: Ein Test beobachtet, was ankommt.
 */
export type PushWelt = {
  /** VAPID-Schlüssel hinterlegt; sonst `503 PUSH_NICHT_KONFIGURIERT` beim Lesen und beim Probeversand (P2). */
  eingerichtet: boolean
  vapidPublicKey: string
  /** `pushAktiv` der Konfiguration (Anlagenebene). */
  anlageAktiv: boolean
  /** Personenschalter. */
  pushErwuenscht: boolean
  /** Rolle der Sitzung: GAST bekommt an jedem Endpunkt `403` (A25d), nur ADMIN darf den Probeversand. */
  rolle: 'USER' | 'ADMIN' | 'GAST'
  /** Angemeldete Endpoint-Adressen (die Geräte der Person). */
  endpunkte: Set<string>
  /** Zahl der Aufrufe je Endpunkt. */
  zaehler: Record<PushAufruf, number>
  /** Zuletzt gesendeter Körper von `abo/anlegen`. */
  letzterAboKoerper: AboAnlegen | null
  /** `X-FuBo-Kein-Refresh` je Aufruf von `abo/anlegen`, in Reihenfolge. */
  anlegenKoepfe: (string | null)[]
  /** Gesendeter `Content-Type` des Probeversands (`null` ohne Körper). */
  probeInhaltstyp: string | null | undefined
  /** Gesendeter Körper des Probeversands als Text (`''` ohne Körper). */
  probeKoerper: string | undefined
  /** Reihenfolge aller Aufrufe (für Reihenfolgetests). */
  verlauf: PushAufruf[]
  /** Liefert `abo/anlegen` stattdessen diese Antwort (Fehlerfälle). */
  anlegenAntwort?: () => Response
  /** Liefert `abo/entfernen` stattdessen diese Antwort. */
  entfernenAntwort?: () => Response
  /** Liefert `einstellung/aendern` stattdessen diese Antwort. */
  einstellungAntwort?: () => Response
  /** Liefert `status/lesen` stattdessen diese Antwort. */
  statusAntwort?: () => Response
}

/** Baut eine Welt mit Vorgaben: eingerichtet, Anlage an, Person an, Rolle USER, kein Gerät. */
export function pushWelt(anfang: Partial<PushWelt> = {}): PushWelt {
  return {
    eingerichtet: true,
    vapidPublicKey: BEISPIEL_VAPID,
    anlageAktiv: true,
    pushErwuenscht: true,
    rolle: 'USER',
    endpunkte: new Set(),
    zaehler: { schluessel: 0, status: 0, einstellung: 0, anlegen: 0, entfernen: 0, probe: 0 },
    letzterAboKoerper: null,
    anlegenKoepfe: [],
    probeInhaltstyp: undefined,
    probeKoerper: undefined,
    verlauf: [],
    ...anfang,
  }
}

const VERBOTEN = () => problem(403, 'KEINE_BERECHTIGUNG', 'Für Gäste gibt es keine Benachrichtigungen.')
const NICHT_EINGERICHTET = () =>
  problem(503, 'PUSH_NICHT_KONFIGURIERT', 'Push-Benachrichtigungen sind auf diesem Server nicht eingerichtet.')

/**
 * Handler der sechs Push-Endpunkte über einer {@link PushWelt}. **Vor** allgemeinere Handler setzen (MSW nimmt den
 * ersten Treffer); in `mockServer.use(...)` gewinnt der zuerst genannte.
 */
export function pushHandler(welt: PushWelt) {
  function zaehlen(aufruf: PushAufruf) {
    welt.zaehler[aufruf] += 1
    welt.verlauf.push(aufruf)
  }
  return [
    http.get('*/push/schluessel/lesen', () => {
      zaehlen('schluessel')
      if (welt.rolle === 'GAST') return VERBOTEN()
      if (!welt.eingerichtet) return NICHT_EINGERICHTET()
      return HttpResponse.json({ vapidPublicKey: welt.vapidPublicKey })
    }),
    http.get('*/push/status/lesen', () => {
      zaehlen('status')
      if (welt.rolle === 'GAST') return VERBOTEN()
      if (welt.statusAntwort) return welt.statusAntwort()
      return HttpResponse.json({ anlageAktiv: welt.anlageAktiv, pushErwuenscht: welt.pushErwuenscht })
    }),
    http.post('*/push/einstellung/aendern', async ({ request }) => {
      zaehlen('einstellung')
      if (welt.rolle === 'GAST') return VERBOTEN()
      if (welt.einstellungAntwort) return welt.einstellungAntwort()
      const { pushErwuenscht } = (await request.json()) as { pushErwuenscht?: unknown }
      if (typeof pushErwuenscht !== 'boolean') {
        return problem(400, 'EINGABE_UNGUELTIG', 'Die Eingabe ist ungültig.', { pushErwuenscht: 'Pflichtfeld.' })
      }
      welt.pushErwuenscht = pushErwuenscht
      return HttpResponse.json({ pushErwuenscht: welt.pushErwuenscht })
    }),
    http.post('*/push/abo/anlegen', async ({ request }) => {
      zaehlen('anlegen')
      welt.anlegenKoepfe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      if (welt.rolle === 'GAST') return VERBOTEN()
      const koerper = (await request.json()) as AboAnlegen
      welt.letzterAboKoerper = koerper
      if (welt.anlegenAntwort) return welt.anlegenAntwort()
      if (!koerper.endpoint?.startsWith('https://')) {
        return problem(400, 'EINGABE_UNGUELTIG', 'Die Eingabe ist ungültig.', { endpoint: 'Muss mit https:// beginnen.' })
      }
      welt.endpunkte.add(koerper.endpoint)
      return HttpResponse.json({ aboVorhanden: true })
    }),
    http.post('*/push/abo/entfernen', async ({ request }) => {
      zaehlen('entfernen')
      if (welt.rolle === 'GAST') return VERBOTEN()
      if (welt.entfernenAntwort) return welt.entfernenAntwort()
      const { endpoint } = (await request.json()) as { endpoint: string }
      welt.endpunkte.delete(endpoint)
      // Immer `200` mit `false`, auch für unbekannte Adressen (P4).
      return HttpResponse.json({ aboVorhanden: false })
    }),
    http.post('*/admin/push/test', async ({ request }) => {
      zaehlen('probe')
      welt.probeInhaltstyp = request.headers.get('Content-Type')
      welt.probeKoerper = await request.text()
      if (welt.rolle !== 'ADMIN') return problem(403, 'KEINE_BERECHTIGUNG', 'Nur für Admins.')
      if (!welt.eingerichtet) return NICHT_EINGERICHTET()
      const empfaenger = welt.endpunkte.size
      return HttpResponse.json({ empfaenger, zugestellt: empfaenger })
    }),
  ]
}
