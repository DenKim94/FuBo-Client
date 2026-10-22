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

/** Skill-Stufe eines Gastes (Selbsteinschätzung, A8). */
export type GastStufe = components['schemas']['GastStufe']

/** Körper von `POST /admin/teilnahme/gast-stufe`: Termin, Gastname (zeichengenau) und neue Stufe. */
export type GastStufeAenderung = components['schemas']['GastStufeRequest']

/** Körper von `POST /admin/ergebnis/korrigieren` (`ErgebnisKorrigierenRequest`): Voll-Update mit `version`. */
export type ErgebnisKorrektur = components['schemas']['ErgebnisKorrigierenRequest']

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

/**
 * Korrigiert die Skill-Stufe eines Gastes an einer Teilnahme (`204`, C8 E13).
 *
 * **Die einzige Adminaktion an einer Teilnahme:** Zusage, Name und Position in der Warteschlange ändern sich nicht.
 * Der Vorgang erhöht die `teilnehmerVersion` des Termins (eine vorhandene Einteilung gilt danach als veraltet) und
 * öffnet das Generierungskontingent neu. Auch die Stufe eines abgesagten Gastes lässt sich setzen.
 *
 * **`gastName` geht roh hinaus:** ohne „(Gast)“, ohne Trimmen – der Server vergleicht zeichengenau.
 * Fehler: `404 INHALT_NICHT_GEFUNDEN` (für diesen Termin liegt keine Teilnahme dieses Gastes vor).
 *
 * @param anfrage `terminId`, `gastName` (wie `teilnehmer[].anzeigeName`) und `stufe`.
 */
export async function gastStufeAendern(anfrage: GastStufeAenderung): Promise<void> {
  await aufrufen<void>('POST', '/admin/teilnahme/gast-stufe', { body: anfrage })
}

/**
 * Sagt den Termin per E-Mail an den Hallenbetreiber ab (`POST /admin/halle/absagen`, `204`, C8 10.1).
 *
 * **Versendet eine echte E-Mail und ist nicht zurückzunehmen.** Ein geplanter Termin wird dabei ebenfalls `ABGESAGT`;
 * `halleAbgesagtAm` ist danach gesetzt. Fehler (`409`), in der Reihenfolge der Prüfung am Server:
 * `HALLE_MODUS_INAKTIV` (**auch für unbekannte Termine**, nicht `404`), `TERMIN_GESCHLOSSEN`, `HALLE_FRIST_ABGELAUFEN`,
 * `HALLE_NICHT_KONFIGURIERT` und `HALLE_BEREITS_ABGESAGT` (**kein Bedienfehler**, sondern ein Doppelklick).
 * `503 VERSAND_FEHLGESCHLAGEN`: Es bleibt nichts zurück, der Aufruf lässt sich unverändert wiederholen – vom Menschen,
 * **nie automatisch** (Mutationen werden nicht wiederholt).
 *
 * @param terminId Id des Termins.
 */
export async function halleAbsagen(terminId: number): Promise<void> {
  await aufrufen<void>('POST', '/admin/halle/absagen', { body: { terminId } })
}

/**
 * Korrigiert ein erfasstes Ergebnis (`POST /admin/ergebnis/korrigieren`, `204`, C8 10.2; zog aus `admin.ts` hierher).
 *
 * **Voll-Update:** `sieger`, `deutlich` und `version` sind Pflicht, auch wenn sich ein Wert nicht ändert. `version` ist
 * der Stand aus dem Feld `ergebnis` der Einzelansicht. Bei Abweichung antwortet der Server mit `409 DATEN_VERALTET` –
 * das heißt **„neu laden und erneut speichern“, nicht „Eingabe falsch“**. `404`: Für den Termin liegt kein Ergebnis vor.
 * **Bei `sieger: 'U'` ist `deutlich: true` ein `400`;** die Oberfläche sendet dann `false` (der Aufrufer setzt es).
 *
 * @param anfrage Termin, neuer Ausgang und der Stand des Datensatzes.
 */
export async function ergebnisKorrigieren(anfrage: ErgebnisKorrektur): Promise<void> {
  await aufrufen<void>('POST', '/admin/ergebnis/korrigieren', { body: anfrage })
}
