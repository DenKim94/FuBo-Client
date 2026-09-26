import { HttpResponse, http } from 'msw'
import type { components } from '@/api/schema'

/** Beispielsitzung. Keine realen Personennamen (Vorgabe AGENT_CLIENT.md). */
export const beispielSitzung: components['schemas']['SitzungInfo'] = {
  stage: 'PROFILE_AUTHENTICATED',
  rolle: 'USER',
  anzeigeName: 'Beispielspieler 03',
  gueltigBis: '2026-09-26T16:12:00Z',
  absolutGueltigBis: '2026-09-26T17:00:00Z',
}

/**
 * Baut eine Fehlerantwort im Vertragsformat.
 *
 * `type` ist im Generat Pflichtfeld, weil der Kontrakt dafür einen Vorgabewert
 * angibt – ein handgeschriebenes Fehlerobjekt ohne dieses Feld meldet `TS2741`.
 *
 * @param status HTTP-Statuscode der Antwort.
 * @param code Maschinenlesbarer Fehlercode, nach dem die Programmlogik verzweigt.
 * @param detail Deutschsprachiger Anzeigetext.
 */
export function problem(
  status: number,
  code: components['schemas']['Fehlercode'],
  detail: string,
): Response {
  const rumpf: components['schemas']['ProblemDetail'] = {
    type: 'about:blank',
    status,
    code,
    detail,
  }
  // Jede Fehlerantwort des Servers trägt `application/problem+json`, nie
  // `application/json` – der Mock bildet das nach, damit ein Test die
  // Unterscheidung überhaupt prüfen kann.
  return HttpResponse.json(rumpf, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

/**
 * Vorgabeverhalten der API für Tests.
 *
 * Die Muster beginnen mit `*`, weil das Präfix aus `VITE_API_BASE_URL` kommt und
 * im Test relativ ist. Ein absolutes Muster liefe in Vitest und im Browser
 * auseinander.
 *
 * Einzelne Tests überschreiben einen Handler gezielt über `mockServer.use(...)`;
 * das `resetHandlers` nach jedem Test stellt diesen Ausgangszustand wieder her.
 */
export const handlers = [
  http.get('*/auth/session/lesen', () => HttpResponse.json(beispielSitzung)),

  // 204 ohne Rumpf – der Fall, den 23 der 44 Operationen liefern.
  http.post('*/auth/pin/pruefen', () => new HttpResponse(null, { status: 204 })),

  http.post('*/termine/rueckmeldung', () =>
    problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen.'),
  ),
]
