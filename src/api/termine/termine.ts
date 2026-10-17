import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Ein Termin in der Listenansicht (`GET /termine/lesen`). */
export type TerminUebersicht = components['schemas']['TerminUebersicht']

/** Einzelansicht eines Termins samt Teilnehmerliste, Teams und Ergebnis. */
export type TerminDetails = components['schemas']['TerminDetails']

/** Zusagen eines Termins samt Mindest- und Höchstzahl. */
export type Teilnehmerliste = components['schemas']['Teilnehmerliste']

/** Ein Eintrag der Teilnehmerliste. */
export type TeilnehmerEintrag = components['schemas']['TeilnehmerEintrag']

/** Zustand eines Termins: `GEPLANT`, `ABGESAGT` oder `ABGESCHLOSSEN`. */
export type TerminStatus = components['schemas']['TerminStatus']

/** Optionen von {@link termineLesen}. */
export type TermineLesenOptionen = {
  /**
   * Stichtag `YYYY-MM-DD`: liefert auch vergangene Termine ab diesem Tag
   * (Verlauf). Ohne Angabe gilt „heute“ in der Zeitzone der Anwendung.
   */
  ab?: string
  /** Hintergrundabruf: verlängert das gleitende Sitzungsfenster nicht (Polling). */
  keinRefresh?: boolean
}

/**
 * Liest die Termine (`GET /termine/lesen`, Stufe `PROFILE_AUTHENTICATED`, auch GAST).
 *
 * Die Liste kommt **aufsteigend nach Beginn** sortiert und enthält abgesagte
 * Termine (`status = ABGESAGT`), damit niemand ins Leere läuft. Ohne `ab` fehlen
 * die vergangenen. **`ab` ist eine untere Grenze ohne Obergrenze und ohne Limit:**
 * Wer vergangene Termine will, bekommt auch alle künftigen und filtert selbst
 * (`vergangeneTermine`).
 *
 * @param optionen Stichtag und Schalter für Hintergrundabrufe; beides optional.
 */
export async function termineLesen(optionen: TermineLesenOptionen = {}): Promise<TerminUebersicht[]> {
  // Ein ISO-Datum braucht kein Escaping; `aufrufen` kennt keine Query-Optionen.
  const pfad = optionen.ab ? `/termine/lesen?ab=${optionen.ab}` : '/termine/lesen'
  return aufrufen<TerminUebersicht[]>('GET', pfad, { keinRefresh: optionen.keinRefresh })
}

/**
 * Liest einen Termin mit Teilnehmerliste (`GET /termine/{terminId}/lesen`).
 *
 * Die Teilnehmerliste hat keinen eigenen Endpunkt; auch die Teameinteilung
 * (`teams`) und das Ergebnis (`ergebnis`) reisen hier mit und sind im
 * Normalzustand `null`. Fehler: `404 INHALT_NICHT_GEFUNDEN` (der Termin
 * existiert nicht mehr).
 *
 * @param terminId Technischer Schlüssel des Termins.
 * @param keinRefresh Bei zyklischen Abrufen `true` (Polling), damit das Fenster
 *   der Sitzung nicht durch die Abfrage selbst verlängert wird.
 */
export async function terminLesen(terminId: number, keinRefresh = false): Promise<TerminDetails> {
  return aufrufen<TerminDetails>('GET', `/termine/${terminId}/lesen`, { keinRefresh })
}

/**
 * Meldet die eigene Zu- oder Absage (`POST /termine/rueckmeldung`, `204`).
 *
 * Eine Bedienung und deshalb **ohne** `X-FuBo-Kein-Refresh`: Sie zählt als
 * Aktivität und verlängert das Sitzungsfenster. Die Antwort enthält keine neue
 * Liste; wer das Ergebnis anzeigen will, liest neu (`invalidateQueries`).
 *
 * **Eine erneute Zusage stellt hinten an** (`gemeldet_am` wird bei jeder Zusage
 * neu gesetzt). Fehler: `409 TERMIN_GESCHLOSSEN` (der Termin hat begonnen oder
 * ist nicht mehr `GEPLANT`), `409 PROFIL_GESCHUETZT` (Rolle ADMIN),
 * `404 INHALT_NICHT_GEFUNDEN`.
 *
 * @param terminId Technischer Schlüssel des Termins.
 * @param zusage `true` sagt zu, `false` sagt ab.
 */
export async function rueckmeldungSenden(terminId: number, zusage: boolean): Promise<void> {
  await aufrufen<void>('POST', '/termine/rueckmeldung', { body: { terminId, zusage } })
}
