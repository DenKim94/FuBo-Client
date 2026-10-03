import type { components } from '@/api/common/types/schema'

/** Einheitliches Fehlerformat des Servers (RFC 9457). */
export type ProblemDetail = components['schemas']['ProblemDetail']

/** Maschinenlesbarer Fehlercode; 34 Werte im Kontrakt. */
export type Fehlercode = components['schemas']['Fehlercode']

/**
 * Fehler eines API-Aufrufs.
 *
 * Trägt drei Dinge getrennt: den Statuscode für die Ablaufsteuerung, den
 * `code` für die Programmlogik und `message` als bereits deutschsprachigen
 * Anzeigetext des Servers.
 *
 * **Maßgeblich ist `code`, nicht der Text.** Der Kontrakt hält ausdrücklich
 * fest, dass `detail` Anzeigetext ist und sich ohne Vertragsänderung ändern
 * darf. Eine Verzweigung über den Text bräche, sobald jemand ein Komma setzt.
 */
export class ApiFehler extends Error {
  readonly status: number
  readonly code: Fehlercode | 'UNBEKANNT'
  /** Nur bei 429: Restwartezeit in Sekunden (aus dem Rumpf, nicht aus `Retry-After`). */
  readonly wartesekunden?: number

  constructor(status: number, code: Fehlercode | 'UNBEKANNT', text: string, wartesekunden?: number) {
    super(text)
    this.name = 'ApiFehler'
    this.status = status
    this.code = code
    this.wartesekunden = wartesekunden
  }
}

/**
 * Erkennt den Fall „es kam gar keine Antwort".
 *
 * `fetch` wirft nur bei Netzfehlern einen `TypeError`; eine Antwort mit `4xx`
 * oder `5xx` gilt ihm als Erfolg. Ein {@link ApiFehler} bedeutet deshalb immer
 * „der Server hat geantwortet, aber abgelehnt", während dieser Fall bedeutet,
 * dass die Gegenstelle nicht erreichbar war. Die Oberfläche behandelt beides
 * unterschiedlich: Das eine ist eine Meldung, das andere der Offline-Hinweis.
 *
 * Die Prüfung steht hier und nicht in jeder Ansicht, damit niemand `TypeError`
 * abfragen muss, um „offline" zu erkennen. Ein abgebrochener Aufruf
 * (`AbortError`) zählt bewusst **nicht** dazu: Ihn löst die Anwendung selbst
 * aus, etwa beim Verlassen einer Ansicht, und er verdient keine Meldung.
 */
export function istNetzfehler(fehler: unknown): boolean {
  return fehler instanceof TypeError
}

/** Eigene Worte für den einzigen Fall, in dem kein `detail` des Servers vorliegt: keine Antwort. */
export const TEXT_NICHT_ERREICHBAR = 'Der Server ist nicht erreichbar. Bitte prüfe deine Verbindung.'

/**
 * Bildet den Anzeigetext eines fehlgeschlagenen Aufrufs.
 *
 * **Keine Übersetzungstabelle:** Hat der Server geantwortet, ist der Text sein
 * `detail` – unverändert, denn er kennt Restversuche, Wartezeiten und Namen
 * genauer als der Client. Eigene Worte gibt es nur, wo gar keine Antwort kam
 * (Netzfehler), und als letzter Rückfall für Fehler, die nicht aus `aufrufen`
 * stammen.
 *
 * Steht hier neben {@link istNetzfehler} und nicht in einer Komponente: Die
 * Unterscheidung „Antwort oder keine Antwort“ gehört zur API-Schicht, und
 * `Fehlermeldung` wie `Fehlerzustand` brauchen denselben Text. Vorher trugen
 * `PinEingabe` und `Namensauswahl` je eine eigene Kopie.
 *
 * @param fehler Der Fehler einer Abfrage oder Mutation, beliebigen Typs.
 * @param ersatz Text für Fehler, die weder `ApiFehler` noch Netzfehler sind.
 * @returns Der anzuzeigende Text.
 */
export function fehlertextBilden(fehler: unknown, ersatz = 'Unbekannter Fehler.'): string {
  if (fehler instanceof ApiFehler) return fehler.message
  if (istNetzfehler(fehler)) return TEXT_NICHT_ERREICHBAR
  return ersatz
}

/**
 * Sagt, ob ein zweiter Versuch etwas ändern kann.
 *
 * Ja bei einem Netzfehler und bei `≥ 500` – dieselbe Grenze, die die
 * Wiederholungsregel in `queryClient.ts` zieht. Nein bei jeder anderen Antwort:
 * `403`, `404` oder `409` sind fachliche Ablehnungen, ein neuer Versuch liefert
 * dieselbe Antwort, und eine angebotene Schaltfläche wäre ein leeres Versprechen.
 *
 * @param fehler Der Fehler einer Abfrage oder Mutation, beliebigen Typs.
 */
export function istWiederholbar(fehler: unknown): boolean {
  if (istNetzfehler(fehler)) return true
  return fehler instanceof ApiFehler && fehler.status >= 500
}
