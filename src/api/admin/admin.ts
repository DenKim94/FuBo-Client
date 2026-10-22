import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Body der Passwortänderung laut Kontrakt (`PasswortAendernRequest`). */
export type PasswortAenderung = components['schemas']['PasswortAendernRequest']

/** Body der PIN-Änderung laut Kontrakt (`PinAendernRequest`): nur die neue PIN, vier Ziffern. */
export type PinAenderung = components['schemas']['PinAendernRequest']

/** Body der Namensanforderung laut Kontrakt (`AdminNameAendernRequest`). */
export type NameAnforderung = components['schemas']['AdminNameAendernRequest']

/** Body der Namensbestätigung laut Kontrakt (`AdminNameBestaetigenRequest`): nur die fünfstellige PIN, **kein Name**. */
export type NameBestaetigung = components['schemas']['AdminNameBestaetigenRequest']

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
 * Ändert die zentrale PIN (`POST /admin/pin/aendern`, `204`, Rolle `ADMIN`, A3).
 *
 * Vier Ziffern (`^\d{4}$`), **kein Feld für die alte PIN**. Der Server prüft das
 * Format; der Anmeldeendpunkt prüft es nicht (ein Bestand wie `FUBO_INITIAL_PIN`
 * bleibt eingebbar).
 *
 * **Bei Erfolg sind ALLE Sitzungen widerrufen** – die aufrufende, die der Spieler
 * und die der Gäste; belegte Gastplätze werden freigegeben. Der Aufrufer räumt
 * deshalb im Client auf (`sitzungsendeAusloesen`), statt auf den nächsten `401` zu warten.
 *
 * Fehler als `ApiFehler`: `400 EINGABE_UNGUELTIG` mit `felder.neuePin`, `401 SESSION_UNGUELTIG`.
 *
 * @param anfrage Die neue PIN im Klartext.
 */
export async function zentralePinAendern(anfrage: PinAenderung): Promise<void> {
  await aufrufen<void>('POST', '/admin/pin/aendern', { body: anfrage })
}

/**
 * Fordert die Änderung des Anmeldenamens an (`POST /admin/name/aendern`, **`202`
 * ohne Rumpf**, Rolle `ADMIN`).
 *
 * Der Name wird **noch nicht geändert**: Der Server prüft ihn und schickt eine
 * fünfstellige PIN an die hinterlegte E-Mail-Adresse. Die Antwort enthält nichts
 * (auch nicht die Adresse). Jede Anforderung entwertet die zuvor offene.
 *
 * Fehler als `ApiFehler`: `400 EINGABE_UNGUELTIG`, `409 NAME_BELEGT` (es wurde nichts
 * gesendet), `429 NAME_AENDERUNG_GEDROSSELT` (höchstens drei je Stunde), `503
 * VERSAND_FEHLGESCHLAGEN` (nichts bleibt zurück, der Aufruf ist wiederholbar).
 *
 * @param anfrage Der gewünschte neue Anmeldename; Randleerzeichen entfernt der Server.
 */
export async function adminNameAnfordern(anfrage: NameAnforderung): Promise<void> {
  await aufrufen<void>('POST', '/admin/name/aendern', { body: anfrage })
}

/**
 * Löst die Bestätigungs-PIN der Namensänderung ein (`POST /admin/name/bestaetigen`,
 * `204`, Rolle `ADMIN`).
 *
 * **Kein Name im Körper:** Der Server kennt den angeforderten Namen. **Die Sitzung
 * bleibt bestehen**, der neue Name gilt erst bei der **nächsten** Anmeldung
 * (zeichengenau, Groß-/Kleinschreibung zählt).
 *
 * Fehler als `ApiFehler`: `401 NAME_PIN_FALSCH` (ein Versuch verbraucht, fünf je
 * Vorgang; **kein Sitzungsende**), `409 NAME_AENDERUNG_UNGUELTIG` (nie angefordert,
 * abgelaufen, eingelöst, entwertet oder Versuche erschöpft – bewusst nicht
 * unterschieden), `409 NAME_BELEGT` (auch jetzt noch), `429 PIN_GESPERRT` mit
 * `wartesekunden`, `400 EINGABE_UNGUELTIG`.
 *
 * @param anfrage Die fünfstellige Bestätigungs-PIN aus der E-Mail.
 */
export async function adminNameBestaetigen(anfrage: NameBestaetigung): Promise<void> {
  await aufrufen<void>('POST', '/admin/name/bestaetigen', { body: anfrage })
}
