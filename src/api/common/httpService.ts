import { ApiFehler, istNetzfehler, TEXT_NICHT_ERREICHBAR, type Fehlercode } from '@/api/common/fehler'
import { verbindungMelden } from '@/api/common/verbindungsStatus'

/**
 * Basis aller Aufrufe.
 *
 * In der Entwicklung relativ (`/api/v1`), damit der Dev-Proxy greift und
 * Anwendung und API unter demselben Origin laufen. Produktiv setzt Cloudflare
 * Pages die vollständige Adresse.
 */
const BASIS = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Erfolgsstatus, die laut Kontrakt keinen Rumpf tragen (`204`, seit 04.10.2026 auch `202`). */
const ANTWORT_OHNE_RUMPF: readonly number[] = [202, 204]

/** Im Kontrakt kommen nur diese beiden Methoden vor (45 Operationen). */
export type Methode = 'GET' | 'POST'

/** Zusatzangaben eines Aufrufs. */
export type AufrufOptionen = {
  /** Wird als JSON gesendet. Fehlt er, geht kein Rumpf und kein `Content-Type` hinaus. */
  body?: unknown
  /** Hintergrundaufruf: verlängert das gleitende Sitzungsfenster nicht. */
  keinRefresh?: boolean
  signal?: AbortSignal
}

/**
 * Führt einen Aufruf gegen die API aus.
 *
 * **Der einzige Ort im Client, an dem `fetch` aufgerufen wird.** Wirft bei jeder
 * Fehlerantwort einen {@link ApiFehler}; der Aufrufer muss den Statuscode nicht
 * kennen. Bei `204` und `202` liefert die Funktion `undefined` – das betrifft 24
 * der 45 Operationen und wäre mit `json()` ein `SyntaxError`.
 *
 * @param methode HTTP-Methode laut Kontrakt.
 * @param pfad Pfad **ohne** Versionspräfix, z. B. `/auth/session/lesen`.
 * @param optionen Rumpf, Abbruchsignal und der Schalter für Hintergrundaufrufe.
 */
export async function aufrufen<T>(
  methode: Methode,
  pfad: string,
  optionen: AufrufOptionen = {},
): Promise<T> {
  const header: Record<string, string> = { Accept: 'application/json' }
  if (optionen.body !== undefined) header['Content-Type'] = 'application/json'
  // Nur der exakte Wert `true` zählt serverseitig: Ein Tippfehler führt damit
  // zum bisherigen Verhalten und nicht zu einer Sitzung, die nie abläuft.
  if (optionen.keinRefresh) header['X-FuBo-Kein-Refresh'] = 'true'

  let antwort: Response
  try {
    antwort = await fetch(`${BASIS}${pfad}`, {
      method: methode,
      // Das Sitzungscookie ist HttpOnly. Ohne diese Zeile geht es nicht mit,
      // und jeder Aufruf antwortet mit 401 (AGENT_CLIENT.md).
      credentials: 'include',
      headers: header,
      body: optionen.body === undefined ? undefined : JSON.stringify(optionen.body),
      signal: optionen.signal,
    })
  } catch (fehler) {
    // `fetch` wirft nur, wenn gar keine Antwort kam. Das ist der einzige
    // verlaessliche Beweis dafuer, dass der Server nicht erreichbar ist –
    // `navigator.onLine` meldet auch im WLAN ohne Internet `true`.
    if (istNetzfehler(fehler)) verbindungMelden(false)
    throw fehler
  }

  // Eine Antwort ist eine Antwort, gleich welchen Status sie traegt: Auch ein
  // `403` beweist, dass die Verbindung steht.
  verbindungMelden(true)

  if (!antwort.ok) throw await erstelleFehlerAntwort(antwort)
  // 24 von 45 Operationen antworten ohne Rumpf; `json()` würfe hier. `202` kam mit
  // dem Vertrag vom 04.10.2026 hinzu (`POST /admin/name/aendern`: angenommen,
  // noch nicht übernommen) und trägt wie `204` keinen Inhalt.
  if (ANTWORT_OHNE_RUMPF.includes(antwort.status)) return undefined as T
  return (await antwort.json()) as T
}

/**
 * Übersetzt eine Fehlerantwort in einen {@link ApiFehler}.
 *
 * Jede Fehlerantwort trägt laut Kontrakt den Inhaltstyp
 * `application/problem+json`. Fehlt das erwartete JSON, hat nicht der Server
 * geantwortet, sondern etwas davor – dann bleibt nur ein allgemeiner Text.
 */
async function erstelleFehlerAntwort(antwort: Response): Promise<ApiFehler> {
  try {
    const inhalt = (await antwort.json()) as {
      code?: Fehlercode
      detail?: string
      wartesekunden?: number
      felder?: Record<string, string>
    }
    return new ApiFehler(
      antwort.status,
      inhalt.code ?? 'UNBEKANNT',
      inhalt.detail ?? 'Unbekannter Fehler.',
      // Aus dem Rumpf und nicht aus `Retry-After`: Der Kontrakt führt den Wert
      // an beiden Stellen, der Rumpf ist aber unabhängig davon lesbar, ob die
      // CORS-Freigabe des Kopfes steht.
      inhalt.wartesekunden,
      inhalt.felder,
    )
  } catch {
    // Kein JSON im Rumpf: Die Gegenstelle antwortet nicht wie vereinbart
    // (Proxy-Fehlerseite, abgebrochene Verbindung, HTML statt JSON). Derselbe
    // Text wie bei einem Netzfehler: Für den Nutzer ist beides „nicht erreichbar“.
    return new ApiFehler(antwort.status, 'UNBEKANNT', TEXT_NICHT_ERREICHBAR)
  }
}
