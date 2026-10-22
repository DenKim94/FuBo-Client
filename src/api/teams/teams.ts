import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Die aktuelle Teameinteilung eines Termins (`TerminDetails.teams` und Antwort von {@link teamsGenerieren}). */
export type Teameinteilung = components['schemas']['Teameinteilung']

/** Ein Spieler in einem Team: Name, Gast-Kennzeichen, Auswechselspieler – keine Skillwerte. */
export type TeamEintrag = components['schemas']['TeamEintrag']

/**
 * Löst für einen Termin eine Teameinteilung aus (`POST /teams/generieren`, `201`
 * mit Körper, Stufe `PROFILE_AUTHENTICATED`, auch GAST).
 *
 * Eine Bedienung und deshalb **ohne** `X-FuBo-Kein-Refresh`: Sie zählt als
 * Aktivität. Die Antwort ist dieselbe `Teameinteilung` wie das Feld `teams` des
 * Einzeltermins; **die Wahrheit bleibt der Einzeltermin** – wer die Anzeige
 * aktualisieren will, liest ihn neu (`invalidateQueries`), statt die Antwort in
 * den Cache zu schreiben.
 *
 * Ein Lauf löst die bisherige Einteilung ab und verbraucht Kontingent (je
 * Nutzer, Termin und Kontingentstand; den Stand erhöhen nur neue Zusagen, Skillwert- und Gast-Stufen-Änderungen,
 * **keine Absage**, seit 22.10.2026). Generieren dürfen nur der Admin und wer für den Termin zugesagt hat. Fehler:
 * - `403 KEINE_ZUSAGE`: weder Admin noch zugesagt (nie, wieder abgesagt); geprüft **vor** dem Status
 * - `409 TERMIN_GESCHLOSSEN`: der Termin ist nicht mehr `GEPLANT`
 * - `409 TEAMS_FIXIERT`: der Termin hat begonnen, die Einteilung steht fest
 * - `409 ZU_WENIG_TEILNEHMER`: die Mindestzahl ist nicht erreicht (`detail` nennt Ist und Soll)
 * - `409 SKILLWERTE_UNVOLLSTAENDIG`: für USER und GAST nicht behebbar
 * - `409 KONTINGENT_ERSCHOEPFT`: gesperrt, bis jemand neu zusagt (oder sich ein Skillwert, eine Gast-Stufe ändert)
 * - `409 TEILNEHMER_GEAENDERT`: die Liste änderte sich während des Laufs, wiederholbar
 * - `404 INHALT_NICHT_GEFUNDEN`
 *
 * @param terminId Technischer Schlüssel des Termins.
 */
export async function teamsGenerieren(terminId: number): Promise<Teameinteilung> {
  return aufrufen<Teameinteilung>('POST', '/teams/generieren', { body: { terminId } })
}
