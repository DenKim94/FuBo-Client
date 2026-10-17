import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

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
