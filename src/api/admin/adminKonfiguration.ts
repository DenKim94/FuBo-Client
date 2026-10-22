import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/**
 * Datenzugriff der Konfiguration und der Gastplätze (C8, Stufe 4; ADMIN).
 *
 * **Keine Funktion trägt `keinRefresh`:** Admin-Lesen ohne Kopf (C7 E4), alle Schreibaufrufe ohne Kopf;
 * jeder Aufruf ist eine Bedienung und verlängert das Sitzungsfenster. Pfade stehen nur hier.
 */

/** Antwort von `GET /admin/config/lesen`: die vierzehn änderbaren Felder, dazu `halleAbsageVorlageEffektiv`, `geaendertAm`, `version`. */
export type Konfiguration = components['schemas']['Konfiguration']

/** Körper von `POST /admin/config/aendern`: **ein Voll-Update** mit allen vierzehn Feldern und der `version`. */
export type KonfigurationAnfrage = components['schemas']['KonfigurationAendernRequest']

/** Verfahren der Teamgenerierung (A15). */
export type AlgorithmType = components['schemas']['AlgorithmType']

/** Regel für den Auswechselspieler bei ungerader Teilnehmerzahl (A20b). */
export type AuswechselModus = components['schemas']['AuswechselModus']

/** Ein Gastplatz samt Zustand (`GET /admin/gast/lesen`). */
export type GastPlatzInfo = components['schemas']['GastPlatzInfo']

/**
 * Körper von `POST /admin/gast/freigeben`: **genau eines** der beiden Felder.
 *
 * Eine Union statt zweier optionaler Felder, damit „beide“ und „keines“ nicht zu übersetzen sind (der Server
 * antwortet darauf mit `400`). Die Oberfläche bietet nur `slotIds` an: `alle: true` würde auch Gäste mit lebender
 * Sitzung abmelden (C8, E15).
 */
export type GaesteFreigabe = { slotIds: number[] } | { alle: true }

/**
 * Liest die anwendungsweite Konfiguration (`200`).
 *
 * Wird bei jedem Zugriff frisch aus der Datenbank gelesen; es gibt nichts zu verwerfen. **Vor jedem Schreiben
 * aufzurufen:** `konfigurationAendern` verlangt die `version` aus dieser Antwort zurück.
 */
export async function konfigurationLesen(): Promise<Konfiguration> {
  return aufrufen<Konfiguration>('GET', '/admin/config/lesen')
}

/**
 * Schreibt die Konfiguration vollständig (`204`, ohne Rumpf).
 *
 * Alle Felder sind Pflicht, auch die unveränderten; ein fehlendes Feld ist `400` und wird **nie** als `false`
 * gelesen. Den Körper baut ausschliesslich `konfigurationAnfrage` (`konfigurationEingabe.ts`).
 * Fehler: `409 DATEN_VERALTET` (zwischenzeitlich geändert, nichts geschrieben; neu lesen), `400` mit `felder`
 * (etwa `maxTeilnehmer` unter `minTeilnehmer`).
 *
 * @param anfrage Alle Felder samt `version`.
 */
export async function konfigurationAendern(anfrage: KonfigurationAnfrage): Promise<void> {
  await aufrufen<void>('POST', '/admin/config/aendern', { body: anfrage })
}

/**
 * Liest alle Gastplätze nach Nummer sortiert (`200`), **auch die unwirksamen** (Nummern über `anzGuests`).
 *
 * `belegt` bei `sitzungGueltig: false` ist ein verwaister Platz: Er lässt sich gefahrlos freigeben. Freie Plätze
 * haben `gastName`, `gastStufe`, `belegtSeit` und `sitzungGueltig` als `null`.
 */
export async function gastplaetzeLesen(): Promise<GastPlatzInfo[]> {
  return aufrufen<GastPlatzInfo[]>('GET', '/admin/gast/lesen')
}

/**
 * Gibt belegte Gastplätze frei (`204`).
 *
 * **Der Vorgang meldet den Gast ab:** Zu jedem freigegebenen Platz wird die Sitzung widerrufen. Ein bereits freier
 * Platz wird übersprungen, der Aufruf ist wiederholbar. Fehler: `400` (unbekannte Nummer).
 *
 * @param freigabe Die Plätze (`slotIds`) oder `alle: true`.
 */
export async function gaesteFreigeben(freigabe: GaesteFreigabe): Promise<void> {
  await aufrufen<void>('POST', '/admin/gast/freigeben', { body: freigabe })
}
