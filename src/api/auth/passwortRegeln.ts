/**
 * Regeln für ein neues Admin-Passwort laut Kontrakt (C4, 5.4).
 *
 * Gilt für `PasswortResetBestaetigenRequest.neuesPasswort` und
 * `PasswortAendernRequest.neuesPasswort`: mindestens 10, höchstens 72 Zeichen,
 * **keine Vorgaben zu Zeichenklassen** (Länge trägt mehr als erzwungene
 * Sonderzeichen). Die Obergrenze ist die von BCrypt: Darüber schneidet es
 * stillschweigend ab.
 *
 * Der Client prüft nur zur Bedienung; der Server bleibt die Autorität und
 * antwortet bei einer Verletzung mit `400 EINGABE_UNGUELTIG` und `felder`.
 * Die Passwörter beim *Anmelden* und das bisherige Passwort haben keine
 * Mindestlänge im Vertrag.
 */
export const PASSWORT_MIN_LAENGE = 10
export const PASSWORT_MAX_LAENGE = 72

/**
 * Prüft ein neues Passwort gegen die Regeln des Kontrakts.
 *
 * Zählt die Zeichen so, wie das Eingabefeld und `maxLength` es tun: nach
 * UTF-16-Einheiten (`string.length`). Kein `trim()`: Leerzeichen am Rand
 * gehören zum Passwort.
 */
export function neuesPasswortGueltig(passwort: string): boolean {
  return passwort.length >= PASSWORT_MIN_LAENGE && passwort.length <= PASSWORT_MAX_LAENGE
}

/**
 * Gültigkeit der Bestätigungs-PIN des Resets: 15 Minuten ab Anforderung (Kontrakt).
 *
 * Nur für die **Anzeige** („Gültig bis 20:58 Uhr“, `Restzeitbalken`): Ob die PIN
 * noch gilt, entscheidet der Server (`409 RESET_UNGUELTIG`), nicht die Geräteuhr.
 */
export const RESET_GUELTIG_MS = 15 * 60_000
