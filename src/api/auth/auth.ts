import { ApiFehler } from '@/api/common/fehler'
import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Zustand der eigenen Sitzung, wie der Server ihn meldet. */
export type SitzungInfo = components['schemas']['SitzungInfo']

/** Stufe des zweistufigen Logins. Wird serverseitig erzwungen. */
export type Stage = components['schemas']['Stage']

/** Rolle der angemeldeten Identität. In der Stufe `PIN_VERIFIED` noch nicht gesetzt. */
export type Rolle = components['schemas']['Rolle']

/**
 * Liest die laufende Sitzung.
 *
 * Gibt bei `401` bewusst `null` zurück statt zu werfen: „keine Sitzung" ist der
 * Normalzustand eines nicht angemeldeten Besuchers und kein Fehlerfall.
 *
 * **Zugleich darf dieser eine Aufruf die globale Abmeldung nicht auslösen.**
 * Täte er es, liefe der Startaufruf jedes nicht angemeldeten Besuchers in die
 * Behandlung aus `queryClient.ts`, die auf `/anmelden` umleitet – wo derselbe
 * Aufruf wieder stattfindet. Der `401` wird deshalb hier abgefangen, bevor er
 * den Query-Cache erreicht.
 *
 * @param keinRefresh Bei zyklischen Abrufen `true` setzen (Countdown ab C3),
 *   damit das gleitende Sitzungsfenster nicht durch die Abfrage selbst
 *   verlängert wird.
 */
export async function sitzungLesen(keinRefresh = false): Promise<SitzungInfo | null> {
  try {
    return await aufrufen<SitzungInfo>('GET', '/auth/session/lesen', { keinRefresh })
  } catch (fehler) {
    if (fehler instanceof ApiFehler && fehler.status === 401) return null
    throw fehler
  }
}

/** Body der PIN-Prüfung laut Kontrakt (`PinLoginRequest`). */
export type PinAnfrage = components['schemas']['PinLoginRequest']

/**
 * Erste Stufe des Logins: prüft die zentrale PIN (`POST /auth/pin/pruefen`).
 *
 * Bei Erfolg antwortet der Server mit `204` ohne Body und setzt das
 * Sitzungscookie in der Stufe `PIN_VERIFIED`. Das Ergebnis steht deshalb nicht
 * im Rückgabewert, sondern in der Sitzung: Wer danach wissen will, wo der Login
 * steht, liest `GET /auth/session/lesen` erneut (in C3 über die Invalidierung
 * von `schluessel.sitzung`). Eine bestehende Sitzung widerruft der Server dabei
 * – auch deshalb ist der zwischengespeicherte Sitzungszustand danach veraltet.
 *
 * Die PIN wird unverändert übergeben, weder gekürzt noch auf ein Format
 * geprüft: Der Kontrakt schreibt beim Prüfen bewusst keines vor, und ein
 * abweichender Bestandswert muss eingebbar bleiben. Die Prüfung ist Sache des
 * Servers.
 *
 * Fehler kommen als `ApiFehler` aus `aufrufen` und werden hier nicht abgefangen:
 * - `401` mit `PIN_FALSCH` – auch beim Fehlversuch, der die Sperre auslöst;
 * - `429` mit `PIN_GESPERRT` und der Restwartezeit in `wartesekunden`;
 * - `400` mit `EINGABE_UNGUELTIG` bei leerer oder überlanger Eingabe.
 *
 * @param pin Die eingegebene PIN im Klartext.
 */
export async function pinPruefen(pin: string): Promise<void> {
  const request: PinAnfrage = { pin }
  await aufrufen<void>('POST', '/auth/pin/pruefen', { body: request })
}
