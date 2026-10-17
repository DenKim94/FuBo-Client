import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Body der Ergebniskorrektur laut Kontrakt (`ErgebnisKorrigierenRequest`). */
export type ErgebnisKorrektur = components['schemas']['ErgebnisKorrigierenRequest']

/** Body der Passwortänderung laut Kontrakt (`PasswortAendernRequest`). */
export type PasswortAenderung = components['schemas']['PasswortAendernRequest']

/**
 * Ändert das Admin-Passwort im angemeldeten Zustand
 * (`POST /admin/passwort/aendern`, A22).
 *
 * Verlangt die Rolle `ADMIN` **und** das bisherige Passwort: Die Sitzung beweist,
 * wer handelt, das alte Passwort, dass es der Berechtigte selbst ist.
 *
 * **Bei Erfolg (`204`) ist die aufrufende Sitzung weg.** Der Server widerruft alle
 * Adminsitzungen und löscht das Cookie. Der Aufrufer räumt deshalb im Client
 * auf (`sitzungsendeAusloesen`), statt auf den nächsten `401` zu warten.
 *
 * Fehler als `ApiFehler`: `401 ADMIN_PASSWORT_FALSCH` (das alte Passwort ist
 * falsch; **kein Sitzungsende**, die Sitzung besteht weiter), `401
 * SESSION_UNGUELTIG`, `429 PIN_GESPERRT` mit `wartesekunden` (ein falsches altes
 * Passwort zählt auf den Brute-Force-Zähler), `400 EINGABE_UNGUELTIG` mit
 * `felder`.
 *
 * @param anfrage Bisheriges und neues Passwort im Klartext.
 */
export async function passwortAendern(anfrage: PasswortAenderung): Promise<void> {
  await aufrufen<void>('POST', '/admin/passwort/aendern', { body: anfrage })
}

/**
 * Korrigiert ein erfasstes Ergebnis (`POST /admin/ergebnis/korrigieren`, `204`,
 * Rolle `ADMIN`).
 *
 * **Voll-Update:** `sieger`, `deutlich` und `version` sind Pflicht, auch wenn sich
 * ein Wert nicht ändert. `version` ist der Stand aus der Antwort des Erfassens oder
 * aus dem Feld `ergebnis` der Einzelansicht. Bei Abweichung antwortet der Server
 * mit `409 DATEN_VERALTET` – das heißt **„neu laden und erneut speichern“, nicht
 * „Eingabe falsch“**.
 *
 * In C5 nur die Funktion, keine Maske (E18): Der Admin sieht die Ergebnis-Tabs
 * nicht (E7), die Maske folgt mit der Admin-Oberfläche (C7).
 *
 * @param anfrage Termin, neuer Ausgang und der Stand des Datensatzes.
 */
export async function ergebnisKorrigieren(anfrage: ErgebnisKorrektur): Promise<void> {
  await aufrufen<void>('POST', '/admin/ergebnis/korrigieren', { body: anfrage })
}
