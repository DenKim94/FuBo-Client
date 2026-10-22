import { HttpResponse, http } from 'msw'
import type { components } from '@/api/common/types/schema'
import { problem } from './problem'
import { beispielBilanz, beispielErgebnis, beispielModelle, beispielTermine, detailsVon, teamsAus } from './termine'

// Bestehende Tests importieren `problem` aus dieser Datei.
export { problem }

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
 * Sitzung des Admins (`PROFILE_AUTHENTICATED`, Rolle `ADMIN`) – für Tests der
 * Admin-Ansichten. Zeitpunkte wie bei {@link beispielSitzung} weit in der Zukunft.
 */
export const beispielAdminSitzung: components['schemas']['SitzungInfo'] = {
  ...beispielSitzung,
  rolle: 'ADMIN',
  anzeigeName: 'Beispieladmin',
}

/**
 * Sitzung nach der PIN-Prüfung (`PIN_VERIFIED`, noch ohne Rolle und Namen) – der
 * Ausgangspunkt der Admin-Anmeldung und des Passwort-Resets.
 */
export const beispielPinSitzung: components['schemas']['SitzungInfo'] = {
  ...beispielSitzung,
  stage: 'PIN_VERIFIED',
  rolle: null,
  anzeigeName: null,
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

  // 204 ohne Rumpf – der Fall, den 23 der 45 Operationen liefern.
  http.post('*/auth/pin/pruefen', () => new HttpResponse(null, { status: 204 })),

  http.post('*/auth/session/erneuern', () => new HttpResponse(null, { status: 204 })),
  http.post('*/auth/session/beenden', () => new HttpResponse(null, { status: 204 })),

  http.get('*/auth/users/lesen', () => HttpResponse.json(beispielNamensliste)),
  http.post('*/auth/user/waehlen', () => new HttpResponse(null, { status: 204 })),
  http.post('*/auth/gast/anmelden', () => new HttpResponse(null, { status: 204 })),

  // Admin-Zugang (C4). Erfolg ist der Normalfall; Fehlerfaelle setzt der jeweilige
  // Test ueber `mockServer.use(...)`.
  http.post('*/auth/admin/anmelden', () => new HttpResponse(null, { status: 204 })),
  http.post('*/auth/passwort/zuruecksetzen', () => new HttpResponse(null, { status: 204 })),
  http.post('*/auth/passwort/bestaetigen', () => new HttpResponse(null, { status: 204 })),
  http.post('*/admin/passwort/aendern', () => new HttpResponse(null, { status: 204 })),

  // Admin-Zugangsdaten (C7, Stufe 1): zentrale PIN und Anmeldename. Die Namensanforderung
  // antwortet `202` ohne Rumpf, die Bestaetigung `204`.
  http.post('*/admin/pin/aendern', () => new HttpResponse(null, { status: 204 })),
  http.post('*/admin/name/aendern', () => new HttpResponse(null, { status: 202 })),
  http.post('*/admin/name/bestaetigen', () => new HttpResponse(null, { status: 204 })),

  // Termine (C5). Die Vorgaben sind **zustandslos**: Eine Rückmeldung ändert
  // nichts, damit kein Test den Stand eines anderen erbt. Wer eine Änderung
  // beobachten will, installiert `terminHandlers()` (zustandsbehaftet).
  http.get('*/termine/lesen', () => HttpResponse.json(beispielTermine)),
  http.get('*/termine/:terminId/lesen', ({ params }) => {
    const modell = beispielModelle.find((m) => String(m.terminId) === params.terminId)
    return modell
      ? HttpResponse.json(detailsVon(modell))
      : problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
  }),
  http.post('*/termine/rueckmeldung', () => new HttpResponse(null, { status: 204 })),

  // Teamgenerierung (C5, Stufe 2), zustandslos wie die Rückmeldung: liefert die Einteilung
  // des angefragten Beispieltermins, ändert aber nichts. Kontingent und `veraltet` gibt es
  // nur in `terminHandlers()`.
  // Ergebnis und Bilanz (C5, Stufe 3), zustandslos: feste Antworten. Ablauf des ersten
  // Eintrags und Zaehlung der Bilanz gibt es nur in `terminHandlers()`.
  http.post('*/ergebnis/erfassen', () => HttpResponse.json(beispielErgebnis, { status: 201 })),
  http.get('*/bilanz/lesen', () => HttpResponse.json(beispielBilanz)),

  http.post('*/teams/generieren', async ({ request }) => {
    const { terminId } = (await request.json()) as { terminId: number }
    const modell = beispielModelle.find((m) => m.terminId === terminId)
    return modell
      ? HttpResponse.json(teamsAus(modell), { status: 201 })
      : problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
  }),
]
