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
