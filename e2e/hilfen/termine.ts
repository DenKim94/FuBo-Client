import type { Page, Route } from '@playwright/test'

/**
 * Nachbildung der Termin-Endpunkte fuer die E2E-Tests (ohne Server), C5.
 *
 * **Zustandsbehaftet:** Das Modell ist die Quelle, Liste und Einzelansicht werden
 * bei jedem Abruf daraus berechnet. So aendert eine Zu- oder Absage beide, wie
 * beim echten Server; eine Nachbildung mit festen Antworten koennte nicht zeigen,
 * dass die Ansicht nach der Rueckmeldung den neuen Stand liest.
 *
 * **Zaehlt mit:** Der Kopf `X-FuBo-Kein-Refresh` je Abruf. Lesen im Hintergrund muss
 * ihn tragen (sonst verlaengerte die offene Ansicht die Sitzung und der
 * Ablauf-Dialog kaeme nie), die Rueckmeldung darf ihn nicht tragen (sie ist eine
 * echte Aktivitaet). Die Tests pruefen beides.
 *
 * Wird nach `sitzungNachbilden` aufgerufen: Die zuletzt angemeldete Route gewinnt
 * und ersetzt dort die leere Terminliste.
 */

/** Eigener Anzeigename der nachgebildeten Sitzung (`hilfen/sitzung.ts`). */
export const EIGENER_NAME = 'Beispielspieler 03'

/** Eine Zusage in Meldereihenfolge. */
export type Zusage = { name: string; gast: boolean }

/** Zustand eines Termins am nachgebildeten Server. */
export type TerminModell = {
  terminId: number
  datum: string
  uhrzeit: string
  ort: string | null
  status: 'GEPLANT' | 'ABGESAGT' | 'ABGESCHLOSSEN'
  min: number
  max: number
  zusagen: Zusage[]
  /** Eigene Rueckmeldung, dreiwertig. Bei `true` steht der eigene Name in `zusagen`. */
  eigene: boolean | null
  teilnehmerVersion: number
  /** Einteilung (`teams`) oder `null`: „noch nicht generiert“. */
  teams: Einteilung | null
  /** `teilnehmerVersion`, zu der die Einteilung entstand; `veraltet` folgt dem Vergleich (wie am Server). */
  teamsVersion: number | null
  /** Erlaubte Laeufe der Teamgenerierung je Nutzer und `teilnehmerVersion`. */
  kontingent: number
  /** Erfasstes Ergebnis oder `null`: „noch nicht eingetragen“ (`hilfen/ergebnisse.ts`). */
  ergebnis: ErgebnisModell | null
  /** Verbrauchte Laeufe je `teilnehmerVersion`. */
  laeufe: Record<number, number>
}

/** Das erfasste Ergebnis eines Termins, wie `Ergebnis` es liefert. */
export type ErgebnisModell = {
  sieger: 'A' | 'B' | 'U'
  deutlich: boolean
  erfasstVon: string
  erfasstAm: string
  korrigiertAm: string | null
  version: number
}

/** Ein Eintrag der Einteilung (`TeamEintrag`). */
export type TeamEintrag = { anzeigeName: string; gast: boolean; auswechselspieler: boolean }

/** Die Teameinteilung eines Termins, wie `Teameinteilung` sie liefert, ohne das abgeleitete `veraltet`. */
export type Einteilung = {
  erzeugtAm: string
  erzeugtVon: string
  auswechselspieler: string | null
  teamA: TeamEintrag[]
  teamB: TeamEintrag[]
}

/** Was der nachgebildete Server gesehen hat und wie er sich verhalten soll. */
export type Termine = {
  modelle: TerminModell[]
  /** `X-FuBo-Kein-Refresh` je Abruf der Liste (`undefined`, wenn der Kopf fehlte). */
  listenabrufe: (string | undefined)[]
  /** Dasselbe je Abruf einer Einzelansicht. */
  detailabrufe: (string | undefined)[]
  /** Eingegangene Rueckmeldungen samt Kopf. */
  rueckmeldungen: { terminId: number; zusage: boolean; kopf: string | undefined }[]
  /** Eingegangene Teamgenerierungen samt Kopf (`hilfen/teams.ts`). */
  generierungen: { terminId: number; kopf: string | undefined }[]
  /**
   * Gesetzt: Die naechste Rueckmeldung scheitert mit `409 TERMIN_GESCHLOSSEN` – der
   * Server hat zwischen Anzeige und Tipp etwas entschieden, das der Client nicht
   * kannte. `'abgesagt'`: Der Termin steht danach auf `ABGESAGT`. `'begonnen'`: Er
   * bleibt `GEPLANT` (der Server sieht den Beginn schon, die Uhr des Geraets noch nicht).
   */
  konfliktBeiRueckmeldung: 'abgesagt' | 'begonnen' | null
}

/** Baut ein Terminmodell: ein geplanter Termin im Jahr 2099 mit acht Zusagen, ohne eigene Rueckmeldung. */
export function terminModell(teil: Partial<TerminModell> & { terminId: number }): TerminModell {
  return {
    datum: '2099-01-13',
    uhrzeit: '19:00:00',
    ort: 'Beispielhalle',
    status: 'GEPLANT',
    min: 6,
    max: 22,
    zusagen: [
      ...Array.from({ length: 7 }, (_, i) => ({ name: `Beispielspieler ${String(i + 11)}`, gast: false })),
      { name: 'Beispielgast', gast: true },
    ],
    eigene: null,
    teilnehmerVersion: 1,
    teams: null,
    teamsVersion: null,
    kontingent: 2,
    laeufe: {},
    ergebnis: null,
    ...teil,
  }
}

/** Datum und Uhrzeit (Ortszeit des Browsers) in `minuten` Minuten, auf die Minute gekuerzt. */
export function inMinuten(minuten: number): { datum: string; uhrzeit: string } {
  const t = new Date(Date.now() + minuten * 60_000)
  const zwei = (n: number) => String(n).padStart(2, '0')
  return {
    datum: `${String(t.getFullYear())}-${zwei(t.getMonth() + 1)}-${zwei(t.getDate())}`,
    uhrzeit: `${zwei(t.getHours())}:${zwei(t.getMinutes())}:00`,
  }
}

function uebersicht(m: TerminModell) {
  return {
    terminId: m.terminId,
    serieId: null,
    datum: m.datum,
    uhrzeit: m.uhrzeit,
    ort: m.ort,
    status: m.status,
    teilnehmerVersion: m.teilnehmerVersion,
    zusagen: m.zusagen.length,
    eigeneRueckmeldung: m.eigene,
  }
}

function details(m: TerminModell) {
  return {
    ...uebersicht(m),
    version: 1,
    teilnehmerliste: {
      minTeilnehmer: m.min,
      maxTeilnehmer: m.max,
      mindestzahlErreicht: m.zusagen.length >= m.min,
      teilnehmer: m.zusagen.map((z, i) => ({
        position: i + 1,
        anzeigeName: z.name,
        gast: z.gast,
        wartet: i + 1 > m.max,
      })),
    },
    teams: m.teams
      ? { ...m.teams, veraltet: m.teamsVersion !== null && m.teamsVersion !== m.teilnehmerVersion }
      : null,
    ergebnis: m.ergebnis,
    halleAbgesagtAm: null,
    halleAbsageMoeglichBis: `${m.datum}T${m.uhrzeit.slice(0, 5)}:00`,
  }
}

export function problem(route: Route, status: number, code: string, detail: string) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', status, code, detail },
  })
}

/**
 * Baut eine Einteilung aus den Zusagen: die ersten in Team A, der Rest in Team B, bei
 * ungerader Zahl ist der letzte Eintrag des groesseren Teams Auswechselspieler.
 * Wartende (ab `max`) spielen nicht mit.
 */
export function einteilungAus(m: TerminModell): Einteilung {
  const spieler = m.zusagen.slice(0, m.max)
  const haelfte = Math.ceil(spieler.length / 2)
  const eintrag = (z: Zusage): TeamEintrag => ({ anzeigeName: z.name, gast: z.gast, auswechselspieler: false })
  const teamA = spieler.slice(0, haelfte).map(eintrag)
  const teamB = spieler.slice(haelfte).map(eintrag)
  const ungerade = spieler.length % 2 === 1
  if (ungerade && teamA.length > 0) teamA[teamA.length - 1].auswechselspieler = true
  return {
    erzeugtAm: new Date().toISOString(),
    erzeugtVon: EIGENER_NAME,
    auswechselspieler: ungerade ? (teamA.at(-1)?.anzeigeName ?? null) : null,
    teamA,
    teamB,
  }
}

/** Bildet die Termin-Endpunkte nach und gibt den veraenderbaren Zustand zurueck. */
export async function termineNachbilden(page: Page, modelle: TerminModell[]): Promise<Termine> {
  const welt: Termine = {
    modelle,
    listenabrufe: [],
    detailabrufe: [],
    rueckmeldungen: [],
    generierungen: [],
    konfliktBeiRueckmeldung: null,
  }
  const pfad = (url: URL) => url.pathname

  await page.route(
    (url) => pfad(url) === '/api/v1/termine/lesen',
    (route) => {
      welt.listenabrufe.push(route.request().headers()['x-fubo-kein-refresh'])
      const stichtag = new URL(route.request().url()).searchParams.get('ab')
      const liste = stichtag ? welt.modelle.filter((m) => m.datum >= stichtag) : welt.modelle
      return route.fulfill({ json: liste.map(uebersicht) })
    },
  )

  await page.route(
    (url) => /^\/api\/v1\/termine\/[^/]+\/lesen$/.test(pfad(url)),
    (route) => {
      welt.detailabrufe.push(route.request().headers()['x-fubo-kein-refresh'])
      const id = new URL(route.request().url()).pathname.split('/')[4]
      const modell = welt.modelle.find((m) => String(m.terminId) === id)
      return modell ? route.fulfill({ json: details(modell) }) : problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
    },
  )

  await page.route(
    (url) => pfad(url) === '/api/v1/termine/rueckmeldung',
    async (route) => {
      const { terminId, zusage } = route.request().postDataJSON() as { terminId: number; zusage: boolean }
      welt.rueckmeldungen.push({ terminId, zusage, kopf: route.request().headers()['x-fubo-kein-refresh'] })
      const modell = welt.modelle.find((m) => m.terminId === terminId)
      if (!modell) return problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (welt.konfliktBeiRueckmeldung) {
        if (welt.konfliktBeiRueckmeldung === 'abgesagt') {
          modell.status = 'ABGESAGT'
          modell.zusagen = []
          modell.eigene = null
        }
        welt.konfliktBeiRueckmeldung = null
        return problem(route, 409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen. Eine Rückmeldung ist nicht mehr möglich.')
      }
      modell.zusagen = modell.zusagen.filter((z) => z.name !== EIGENER_NAME || z.gast)
      if (zusage) modell.zusagen.push({ name: EIGENER_NAME, gast: false })
      modell.eigene = zusage
      modell.teilnehmerVersion += 1
      return route.fulfill({ status: 204 })
    },
  )

  return welt
}
