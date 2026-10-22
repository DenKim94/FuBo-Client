import type { TerminDetails } from './termine'

/**
 * Spielt der Aufrufer bei diesem Termin mit? Zugesagt **und** nicht auf der Warteschlange.
 *
 * Grundlage für die Sperre des Team-Generators (Vorgabe des Entwicklers vom 22.10.2026): Nur wer mitspielt, darf
 * die Teams generieren. Wer abgesagt, sich nicht gemeldet hat oder auf der Warteschlange steht, nicht.
 *
 * **Beide Angaben kommen vom Server:** `eigeneRueckmeldung` sagt „zugesagt“, der eigene Eintrag der Teilnehmerliste
 * sagt `wartet`. Den Eintrag findet der Client wie die Teilnehmerliste über Anzeigename **und** Gast-Kennzeichen
 * (ein Gast kann so heißen wie ein Profil). Fehlt der Eintrag trotz Zusage (sollte nicht vorkommen), gilt
 * „spielt nicht mit“: Eine Sperre zu viel ist hier harmloser als eine zu wenig.
 *
 * **Verhältnis zum Server** (`POST /teams/generieren`, seit 22.10.2026): Er weist ohne Zusage mit
 * `403 KEINE_ZUSAGE` ab, lässt aber die Warteschlange und den Admin zu. Der Client ist bei der Warteschlange bewusst
 * strenger (Vorgabe des Entwicklers); den Admin lässt die Seite gesondert zu (`istAdmin`).
 *
 * @param termin Der Termin mit Teilnehmerliste.
 * @param eigenerName Anzeigename der eigenen Sitzung.
 * @param eigenerGast `true` bei einer Gastsitzung.
 */
export function spieltMit(termin: TerminDetails, eigenerName: string | null | undefined, eigenerGast: boolean): boolean {
  if (termin.eigeneRueckmeldung !== true || !eigenerName) return false
  const eintrag = termin.teilnehmerliste.teilnehmer.find((e) => e.anzeigeName === eigenerName && e.gast === eigenerGast)
  return eintrag !== undefined && !eintrag.wartet
}

/**
 * Steht der Aufrufer in der aktuellen Teameinteilung (Team A oder B, auch als Auswechselspieler)?
 *
 * Grundlage der Berechtigung, ein Ergebnis zu erfassen (`POST /ergebnis/erfassen`, seit 22.10.2026; der Admin
 * immer): Der Vertrag sichert zu, dass „eingeteilt“ genau „steht in `teams.teamA` oder `teams.teamB`“ heißt und
 * Name **und** Gast-Kennzeichen den Eintrag eindeutig bestimmen. Die Auskunft ist eine Anzeige; durchgesetzt wird
 * sie vom Server (`403 NICHT_EINGETEILT`).
 *
 * @param teams Die Einteilung des Termins oder `null`.
 * @param eigenerName Anzeigename der eigenen Sitzung.
 * @param eigenerGast `true` bei einer Gastsitzung.
 */
export function istEingeteilt(
  teams: TerminDetails['teams'],
  eigenerName: string | null | undefined,
  eigenerGast: boolean,
): boolean {
  if (!teams || !eigenerName) return false
  return [...teams.teamA, ...teams.teamB].some((e) => e.anzeigeName === eigenerName && e.gast === eigenerGast)
}
