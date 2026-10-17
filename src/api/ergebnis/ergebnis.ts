import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Das Ergebnis eines Termins (`TerminDetails.ergebnis` und Antwort von {@link ergebnisErfassen}). */
export type Ergebnis = components['schemas']['Ergebnis']

/** Ausgang eines Spiels: `A` oder `B` hat gewonnen, `U` unentschieden. */
export type Sieger = components['schemas']['Sieger']

/**
 * Erfasst das Ergebnis eines Termins (`POST /ergebnis/erfassen`, `201` mit
 * Körper, Stufe `PROFILE_AUTHENTICATED`, auch GAST).
 *
 * Eine Bedienung und deshalb **ohne** `X-FuBo-Kein-Refresh`. **Der erste Eintrag
 * gilt:** Ein Ergebnis lässt sich nicht löschen, korrigieren darf nur der Admin.
 * Die Antwort ist dasselbe `Ergebnis` wie das Feld des Einzeltermins; die Wahrheit
 * bleibt der Einzeltermin (E4), wer anzeigen will, liest neu.
 *
 * **Bei `U` geht `deutlich` immer als `false` hinaus**, auch wenn `true`
 * übergeben wird: `true` bei Unentschieden ist unzulässig (`400
 * EINGABE_UNGUELTIG`), und die Oberfläche lässt den Fall nicht entstehen. Der
 * Schutz steht hier doppelt, weil ein Fehler an dieser Stelle einen Termin
 * unerreichbar machte.
 *
 * Fehler: `409 ERGEBNIS_VORHANDEN` (jemand war schneller – **kein Fehler im
 * eigentlichen Sinn**), `409 TERMIN_NICHT_ABGESCHLOSSEN`, `409 KEINE_EINTEILUNG`,
 * `404 INHALT_NICHT_GEFUNDEN`.
 *
 * @param terminId Technischer Schlüssel des Termins.
 * @param sieger Ausgang des Spiels.
 * @param deutlich Ob der Sieg deutlich ausfiel; bei `U` ohne Wirkung.
 */
export async function ergebnisErfassen(terminId: number, sieger: Sieger, deutlich: boolean): Promise<Ergebnis> {
  return aufrufen<Ergebnis>('POST', '/ergebnis/erfassen', {
    body: { terminId, sieger, deutlich: sieger === 'U' ? false : deutlich },
  })
}
