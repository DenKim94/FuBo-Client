import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

type Schemas = components['schemas']

/** Anlagen- und Personenebene der drei Versandbedingungen (die Geräteebene liest der Browser, P1). */
export type PushStatus = Schemas['PushStatus']
/** Die drei Werte aus `PushSubscription`, unverändert (P8). */
export type AboAnlegen = Schemas['AboAnlegenRequest']
/** Zustand des aufrufenden Geräts nach Anlegen oder Entfernen. */
export type AboZustand = Schemas['AboZustand']
/** Ergebnis des Probeversands (Geräte, keine Personen; P6). */
export type Probeversand = Schemas['Probeversand']
/** Der gespeicherte Stand des Personenschalters. */
export type PushEinstellung = Schemas['PushEinstellung']
/** Öffentlicher VAPID-Schlüssel des Servers. */
export type VapidSchluessel = Schemas['VapidSchluesselInfo']

/**
 * Liest den öffentlichen VAPID-Schlüssel (`GET /push/schluessel/lesen`).
 *
 * **`503 PUSH_NICHT_KONFIGURIERT` heißt „gibt es hier nicht“** (P2): kein Fehlerbild, kein zweiter Versuch. Der
 * Schlüssel steht bewusst nirgends im Frontend (P7): Ein Wechsel des Paares entwertet alle Abonnements.
 *
 * @param keinRefresh Nur für den Start-Abgleich (E29): Auch dieses Lesen ist dort keine Bedienung.
 */
export function pushSchluesselLesen(keinRefresh = false): Promise<VapidSchluessel> {
  return aufrufen<VapidSchluessel>('GET', '/push/schluessel/lesen', { keinRefresh })
}

/** Liest Anlagen- und Personenebene (`GET /push/status/lesen`); GAST bekommt `403` (A25d). */
export function pushStatusLesen(): Promise<PushStatus> {
  return aufrufen<PushStatus>('GET', '/push/status/lesen')
}

/**
 * Setzt den Personenschalter (`POST /push/einstellung/aendern`, A25f).
 *
 * Wirkt auf **alle** Geräte der Person und löscht kein Abonnement (P5). Die Antwort ist der **gespeicherte** Stand;
 * die Oberfläche zeigt ihn statt des gesendeten.
 */
export function pushEinstellungAendern(pushErwuenscht: boolean): Promise<PushEinstellung> {
  return aufrufen<PushEinstellung>('POST', '/push/einstellung/aendern', { body: { pushErwuenscht } })
}

/**
 * Meldet das Abonnement dieses Geräts an (`POST /push/abo/anlegen`, A25c).
 *
 * Idempotent über einen Hash der Endpoint-Adresse; heilt ein nach `410` deaktiviertes Abonnement und übernimmt es
 * auf einem geteilten Gerät für die angemeldete Person (P3). Die Werte gehen **unverändert** hinaus (P8).
 *
 * @param abo Die Werte aus `PushSubscription.toJSON()`.
 * @param keinRefresh Nur für den Start-Abgleich (E29): Er ist keine Bedienung und verlängert die Sitzung nicht.
 */
export function pushAboAnlegen(abo: AboAnlegen, keinRefresh = false): Promise<AboZustand> {
  return aufrufen<AboZustand>('POST', '/push/abo/anlegen', { body: abo, keinRefresh })
}

/**
 * Widerruft das Abonnement dieses Geräts (`POST /push/abo/entfernen`).
 *
 * Antwortet **immer** `200` mit `aboVorhanden: false`, auch für unbekannte oder fremde Adressen (P4).
 */
export function pushAboEntfernen(endpoint: string): Promise<AboZustand> {
  return aufrufen<AboZustand>('POST', '/push/abo/entfernen', { body: { endpoint } })
}

/**
 * Probeversand an die eigenen Geräte des Admins (`POST /admin/push/test`).
 *
 * **Ohne Körper** (P6): `body` fehlt, damit auch kein `Content-Type` hinausgeht. Prüft die Versandbedingungen nicht;
 * `empfaenger: 0` ist kein Fehler.
 */
export function pushProbeversand(): Promise<Probeversand> {
  return aufrufen<Probeversand>('POST', '/admin/push/test')
}
