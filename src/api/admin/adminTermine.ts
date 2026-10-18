import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/**
 * Schreibaufrufe der Terminverwaltung (C7, Stufe 3; ADMIN).
 *
 * **Keine Funktion trägt `keinRefresh`:** Jede ist eine Bedienung und verlängert das Sitzungsfenster.
 * Gelesen wird über die vorhandenen Funktionen aus `termine.ts` (`terminLesen` mit `version`).
 * Pfade stehen nur hier; die Oberfläche kennt sie nicht.
 */

/** Körper von `POST /admin/termin/anlegen`: Datum, Uhrzeit, optional der Ort. */
export type TerminAnlegen = components['schemas']['TerminAnlegenRequest']

/** Antwort von `POST /admin/termin/anlegen`. */
export type TerminAngelegt = components['schemas']['TerminAngelegt']

/** Körper von `POST /admin/serie/anlegen`. */
export type SerieAnlegen = components['schemas']['SerieAnlegenRequest']

/** Antwort von `POST /admin/serie/anlegen`: angelegte **und übersprungene** Zeitpunkte. */
export type SerieAngelegt = components['schemas']['SerieAngelegt']

/** Körper von `POST /admin/termin/aendern`: `terminId` und `version`, dazu **nur das Geänderte**. */
export type TerminAendern = components['schemas']['TerminAendernRequest']

/**
 * Legt einen Einzeltermin an (`201`, Rumpf `TerminAngelegt`).
 *
 * Die Uhrzeit darf als `HH:MM` oder `HH:MM:SS` hinausgehen; ein leerer `ort` gehört **weggelassen**
 * (der Server macht aus `""` zwar `null`, aber ein fehlendes Feld sagt es klarer).
 * Fehler: `409 TERMIN_BELEGT` (`datum` und `uhrzeit` sind global eindeutig, auch ein abgesagter
 * Termin belegt den Zeitpunkt), `400` (Vergangenheit, Format).
 *
 * @param anfrage Datum, Uhrzeit und optionaler Ort.
 */
export async function terminAnlegen(anfrage: TerminAnlegen): Promise<TerminAngelegt> {
  return aufrufen<TerminAngelegt>('POST', '/admin/termin/anlegen', { body: anfrage })
}

/**
 * Legt eine befristete Serie an (`201`, Rumpf `SerieAngelegt`).
 *
 * Die Termine entstehen **sofort** (höchstens 52). Zeitpunkte, an denen schon ein Termin liegt,
 * werden **übersprungen und in der Antwort genannt**; die Oberfläche muss sie zeigen. Eine Serie
 * lässt sich danach nicht mehr ändern. Fehler: `400` mit Meldung (Enddatum nicht nach dem Startdatum,
 * kein passender Wochentag, erster Termin vergangen, mehr als 52).
 *
 * @param anfrage Titel, Wochentag (1 = Montag bis 7 = Sonntag), Uhrzeit, Zeitraum, optionaler Ort.
 */
export async function serieAnlegen(anfrage: SerieAnlegen): Promise<SerieAngelegt> {
  return aufrufen<SerieAngelegt>('POST', '/admin/serie/anlegen', { body: anfrage })
}

/**
 * Ändert einen Termin (`204`), mit optimistischer Sperre.
 *
 * `version` ist der Stand, mit dem das Formular gebaut wurde. **Bedeutungen:** ein Feld, das fehlt,
 * bleibt unverändert; beim `ort` leert `""`. Mit `status` lässt sich vorwärts abschliessen
 * (`ABGESCHLOSSEN`) oder absagen (`ABGESAGT`), nie zurück nach `GEPLANT` (`400`).
 * Fehler: `409 DATEN_VERALTET` (nichts geschrieben), `409 TERMIN_BELEGT`, `409 TERMIN_GESCHLOSSEN`,
 * `400` (ein Körper ohne Änderung), `404`.
 *
 * @param anfrage `terminId`, `version` und das Geänderte.
 */
export async function terminAendern(anfrage: TerminAendern): Promise<void> {
  await aufrufen<void>('POST', '/admin/termin/aendern', { body: anfrage })
}

/**
 * Sagt einen geplanten Termin ab (`204`). **Endgültig:** Es gibt keinen Weg zurück nach `GEPLANT`.
 *
 * Ohne `version` (der Vorgang setzt einen festen Wert) und ohne Frist; die Hallenabsage mit
 * Vorlauffrist ist ein anderer Aufruf (C8). Der Termin belegt seinen Zeitpunkt weiter.
 * Fehler: `409 TERMIN_GESCHLOSSEN` (schon abgesagt oder abgeschlossen), `404`.
 *
 * @param terminId Der Termin.
 */
export async function terminAbsagen(terminId: number): Promise<void> {
  await aufrufen<void>('POST', '/admin/termin/absagen', { body: { terminId } })
}

/**
 * Entfernt einen Termin endgültig (`204`); nur, solange nichts darauf verweist.
 *
 * Gedacht für den versehentlich angelegten Termin und als einziger Weg zurück aus einer
 * versehentlichen Absage (sie belegt den Zeitpunkt). Fehler: `409 TERMIN_IN_VERWENDUNG`
 * (Rückmeldungen, Teams oder Ergebnis; dann absagen), `404`.
 *
 * @param terminId Der Termin.
 */
export async function terminEntfernen(terminId: number): Promise<void> {
  await aufrufen<void>('POST', '/admin/termin/entfernen', { body: { terminId } })
}
