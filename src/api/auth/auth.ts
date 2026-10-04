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
 * Behandlung aus `queryClient.ts`, die den Cache leert und zur PIN-Eingabe
 * umleitet – wo derselbe Aufruf wieder stattfindet. Der `401` wird deshalb hier abgefangen, bevor er
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

/**
 * Liest die Sitzung als **Hintergrundaufruf** für die Restlaufzeit
 * (`GET /auth/session/lesen` mit `X-FuBo-Kein-Refresh: true`).
 *
 * Gegenstück zu {@link sitzungLesen} für den zyklischen Abruf des Countdowns:
 * Der Kopf verhindert, dass die Abfrage selbst das gleitende Fenster
 * verlängert – sonst hielte allein die Anzeige der Restlaufzeit die Sitzung am
 * Leben, und der Ablauf-Dialog käme nie.
 *
 * **Anders als {@link sitzungLesen} wirft dieser Aufruf bei `401`** (`ApiFehler`
 * mit `SESSION_UNGUELTIG`). Wer die Restlaufzeit beobachtet, hatte eine Sitzung;
 * ist sie weg, ist sie abgelaufen oder widerrufen worden. Der Fehler läuft in
 * die globale Behandlung in `queryClient.ts`: Cache leeren, zur PIN-Eingabe.
 * Dort ist das richtig; beim Start ohne Sitzung (`sitzungLesen`) wäre es eine
 * Endlosschleife.
 */
export async function sitzungFristLesen(): Promise<SitzungInfo> {
  return aufrufen<SitzungInfo>('GET', '/auth/session/lesen', { keinRefresh: true })
}

/**
 * Verlängert das gleitende Leerlauf-Fenster ausdrücklich
 * (`POST /auth/session/erneuern`, A14).
 *
 * Bei Erfolg (`204`) hat der Server das Fenster nach hinten geschoben und den
 * Token getauscht; das neue Cookie setzt er selbst. **Die harte Obergrenze
 * (`absolutGueltigBis`) wandert nicht mit** – eine Sitzung lässt sich so nicht
 * endlos halten. Das neue Ende steht erst in der nächsten Sitzungsauskunft.
 *
 * Der Aufruf trägt **nicht** `X-FuBo-Kein-Refresh`: Er soll genau das
 * bewirken, was der Kopf verhindert.
 *
 * Fehler als `ApiFehler`: `401 SESSION_UNGUELTIG`, wenn die Sitzung inzwischen
 * abgelaufen ist.
 */
export async function sitzungErneuern(): Promise<void> {
  await aufrufen<void>('POST', '/auth/session/erneuern')
}

/**
 * Meldet ab (`POST /auth/session/beenden`).
 *
 * Der Server widerruft die Sitzung, gibt einen belegten Gastplatz frei und
 * löscht das Cookie. **Der Widerruf ist der wirksame Teil**; das Aufräumen im
 * Client (Cache leeren, zur PIN-Eingabe) ist Sache des Aufrufers. Auch in der
 * Stufe `PIN_VERIFIED` erlaubt: Ein angefangener Login lässt sich abbrechen.
 *
 * Fehler als `ApiFehler`: `401 SESSION_UNGUELTIG`, wenn die Sitzung schon weg
 * ist – für den Nutzer dasselbe Ergebnis wie ein Erfolg.
 */
export async function sitzungBeenden(): Promise<void> {
  await aufrufen<void>('POST', '/auth/session/beenden')
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

/** Ein Eintrag der Namensliste: Id, Name, Belegtstatus. Enthält nie Skillwerte (A12). */
export type NameOption = components['schemas']['NameOption']

/** Selbsteinschätzung eines Gastes (A17). */
export type GastStufe = components['schemas']['GastStufe']

/** Body der Gastanmeldung laut Kontrakt (`GastAnmeldungRequest`). */
export type GastAnfrage = components['schemas']['GastAnmeldungRequest']

/**
 * Liest die wählbaren Namen samt Belegtstatus (`GET /auth/users/lesen`, A4/A6).
 *
 * Bereits in der Stufe `PIN_VERIFIED` erreichbar. Der Server liefert die Liste
 * nach Namen sortiert; das Adminprofil ist nicht enthalten. `belegt` leitet er
 * aus den aktiven Sitzungen ab – der Wert ist also so frisch wie der Abruf.
 *
 * @param keinRefresh Beim Polling `true`: Der zyklische Abruf ist keine
 *   Nutzeraktivität und darf das gleitende Sitzungsfenster nicht verlängern.
 * @returns Die Namensliste in der Reihenfolge des Servers.
 */
export async function namenslisteLesen(keinRefresh = false): Promise<NameOption[]> {
  return aufrufen<NameOption[]>('GET', '/auth/users/lesen', { keinRefresh })
}

/**
 * Zweite Stufe des Logins: übernimmt ein Profil (`POST /auth/user/waehlen`).
 *
 * Gesendet wird die Id, nicht der Name – der Name kann sich über die
 * Profilverwaltung ändern. Bei Erfolg (`204`) steht die Sitzung auf
 * `PROFILE_AUTHENTICATED`, und der Server rotiert das Cookie.
 *
 * Fehler als `ApiFehler`: `409 NAME_BELEGT` (jemand war schneller),
 * `404 INHALT_NICHT_GEFUNDEN` (Profil inzwischen inaktiv), `403` (Sitzung nicht
 * mehr in `PIN_VERIFIED`).
 *
 * @param spielerId Id aus der Namensliste.
 */
export async function nameWaehlen(spielerId: number): Promise<void> {
  const request: components['schemas']['NameAuswahlRequest'] = { spielerId }
  await aufrufen<void>('POST', '/auth/user/waehlen', { body: request })
}

/**
 * Zweite Stufe des Logins für Gäste (`POST /auth/gast/anmelden`, A8/A17).
 *
 * Der Name geht **ohne** den Zusatz „(Gast)" hinaus – das Anhängen ist laut
 * Kontrakt Sache der Oberfläche. Randleerzeichen entfernt der Server.
 *
 * Fehler als `ApiFehler`: `409 NAME_BELEGT` (Name von einem Profil oder Gast
 * belegt, ohne Rücksicht auf Gross- und Kleinschreibung), `409
 * KEIN_GAST_SLOT_FREI` (alle Gastplätze belegt), `400 EINGABE_UNGUELTIG`.
 *
 * @param gastName Temporärer Anzeigename (2 bis 40 Zeichen).
 * @param stufe Selbsteinschätzung; ohne Angabe gilt serverseitig `MITTEL`.
 */
export async function alsGastAnmelden(gastName: string, stufe?: GastStufe): Promise<void> {
  const request: GastAnfrage = { gastName, stufe: stufe ?? null }
  await aufrufen<void>('POST', '/auth/gast/anmelden', { body: request })
}
