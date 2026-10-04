import { HttpResponse, http } from 'msw'
import type { components } from '@/api/common/types/schema'

/**
 * Beispielsitzung. Keine realen Personennamen (Vorgabe AGENT_CLIENT.md).
 *
 * Die Zeitpunkte liegen **weit in der Zukunft**: Seit dem Ablauf-Dialog rechnet
 * der Client mit der Uhr, und eine feste Zeit in der Vergangenheit (wie die
 * früheren 26.09.2026) hiesse „Sitzung schon abgelaufen" und öffnete den Dialog
 * in jedem Test. Tests, die den Ablauf prüfen, überschreiben den Handler mit
 * Zeitpunkten relativ zu `Date.now()`.
 */
export const beispielSitzung: components['schemas']['SitzungInfo'] = {
  stage: 'PROFILE_AUTHENTICATED',
  rolle: 'USER',
  anzeigeName: 'Beispielspieler 03',
  gueltigBis: '2099-01-01T00:15:00Z',
  absolutGueltigBis: '2099-01-01T01:00:00Z',
}

/**
 * Baut die Sitzungsauskunft für Tests des Ablaufs: Enden **relativ zu jetzt**,
 * gerechnet bei jedem Abruf neu.
 *
 * @param leerlaufSek Sekunden bis zum Ende des Leerlauf-Fensters (`gueltigBis`).
 * @param obergrenzeSek Sekunden bis zur harten Obergrenze (`absolutGueltigBis`).
 */
export function sitzungMitRest(
  leerlaufSek: number,
  obergrenzeSek: number,
): components['schemas']['SitzungInfo'] {
  // Eine Uhrablesung für beide: Bei gleichen Sekunden sollen die Zeitpunkte
  // **exakt** gleich sein, wie wenn der Server `gueltigBis` auf die Obergrenze
  // klemmt. Zwei `Date.now()` wichen gelegentlich um eine Millisekunde ab, und
  // „nicht mehr verlängerbar" wurde zufällig zu „verlängerbar".
  const jetzt = Date.now()
  return {
    ...beispielSitzung,
    gueltigBis: new Date(jetzt + leerlaufSek * 1000).toISOString(),
    absolutGueltigBis: new Date(jetzt + obergrenzeSek * 1000).toISOString(),
  }
}

/**
 * Beispiel-Namensliste. Neutrale Platzhalter, ein belegter Name (A6).
 */
export const beispielNamensliste: components['schemas']['NameOption'][] = [
  { id: 11, name: 'Beispielspieler 01', belegt: false },
  { id: 12, name: 'Beispielspieler 02', belegt: true },
  { id: 13, name: 'Beispielspieler 03', belegt: false },
]

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

  http.post('*/auth/session/erneuern', () => new HttpResponse(null, { status: 204 })),
  http.post('*/auth/session/beenden', () => new HttpResponse(null, { status: 204 })),

  http.get('*/auth/users/lesen', () => HttpResponse.json(beispielNamensliste)),
  http.post('*/auth/user/waehlen', () => new HttpResponse(null, { status: 204 })),
  http.post('*/auth/gast/anmelden', () => new HttpResponse(null, { status: 204 })),

  http.post('*/termine/rueckmeldung', () =>
    problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen.'),
  ),
]
