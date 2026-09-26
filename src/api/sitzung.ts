/**
 * Zugriff auf die eigene Sitzung.
 *
 * **Vorlaeufig.** Der allgemeine HTTP-Baustein (Fehleruebersetzung, globales
 * `401`, erzeugte Typen aus `fubo-api.json`) entsteht im naechsten Arbeitspaket.
 * Diese Datei wird dann darauf umgestellt; die Signatur von `sitzungLesen`
 * bleibt dabei erhalten, damit die Routen-Schutzkomponenten unberuehrt bleiben.
 */

/** Stufe des zweistufigen Logins. Wird serverseitig erzwungen. */
export type Stage = 'PIN_VERIFIED' | 'PROFILE_AUTHENTICATED'

/** Rolle der angemeldeten Identitaet. In der Stufe `PIN_VERIFIED` noch nicht gesetzt. */
export type Rolle = 'ADMIN' | 'USER' | 'GAST'

/** Auskunft des Servers ueber die laufende Sitzung. */
export type SitzungInfo = {
  stage: Stage
  /** `null`, solange nur die PIN geprueft wurde. */
  rolle: Rolle | null
  /** Profilname, Gastname oder `null` in der Stufe `PIN_VERIFIED`. */
  anzeigeName: string | null
  /** Ende des gleitenden Leerlauf-Fensters. */
  gueltigBis: string
  /** Harte Obergrenze. Wird nie verschoben, auch nicht durch eine Erneuerung. */
  absolutGueltigBis: string
}

const API_BASIS = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * Liest die laufende Sitzung.
 *
 * Gibt bei `401` bewusst `null` zurueck statt zu werfen: „keine Sitzung" ist der
 * Normalzustand eines nicht angemeldeten Besuchers und kein Fehlerfall. Ein
 * geworfener Fehler zwaenge jede aufrufende Stelle zu einer Fallunterscheidung
 * zwischen „abgemeldet" und „kaputt", obwohl nur die zweite eine Meldung verdient.
 */
export async function sitzungLesen(): Promise<SitzungInfo | null> {
  const antwort = await fetch(`${API_BASIS}/auth/session/lesen`, {
    method: 'GET',
    // Die Authentifizierung laeuft ueber das serverseitige HttpOnly-Cookie.
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (antwort.status === 401) return null
  if (!antwort.ok) {
    throw new Error(`Sitzung konnte nicht gelesen werden (HTTP ${antwort.status}).`)
  }
  return (await antwort.json()) as SitzungInfo
}
