import { HttpResponse, http } from 'msw'
import type { components } from '@/api/common/types/schema'
import { beginnVon } from '@/api/termine/terminZeit'
import { problem } from './problem'

type TerminUebersicht = components['schemas']['TerminUebersicht']
type TerminDetails = components['schemas']['TerminDetails']
type TerminStatus = components['schemas']['TerminStatus']

/**
 * Anzeigename der Beispielsitzung (`beispielSitzung` in `handlers.ts`). Der
 * eigene Eintrag der Teilnehmerliste trägt diesen Namen, damit die Ansicht ihn
 * als „(du)“ erkennt.
 */
export const EIGENER_NAME = 'Beispielspieler 03'

/** Eine Zusage in Meldereihenfolge. Bei einem Gast kann die Stufe stehen (nur der Server kennt sie, C8). */
export type Zusage = { name: string; gast: boolean; stufe?: components['schemas']['GastStufe'] }

/**
 * Zustand eines Termins am nachgebildeten Server.
 *
 * Das Modell ist die Quelle; Liste und Einzelansicht werden daraus **bei jedem
 * Abruf neu berechnet** (`uebersichtVon`, `detailsVon`). So ändert eine Zu- oder
 * Absage beide, wie beim echten Server – ein Mock, der unabhängig von der
 * Anfrage antwortet, kann keine Änderung zeigen (Falle aus C3).
 */
export type TerminModell = {
  terminId: number
  datum: string
  uhrzeit: string
  ort: string | null
  status: TerminStatus
  /** Mindest- und Höchstzahl der Teilnehmer (Vorgabe 6 und 22). */
  min: number
  max: number
  /** Zusagen in Meldereihenfolge, einschließlich der eigenen. */
  zusagen: Zusage[]
  /** Eigene Rückmeldung, dreiwertig. Bei `true` steht der eigene Name in `zusagen`. */
  eigene: boolean | null
  teilnehmerVersion: number
  /** Stand des Datensatzes (optimistische Sperre, C7): steigt mit jedem Schreiben des Admins. */
  version: number
  /** Serie, aus der der Termin stammt; `null` bei einem Einzeltermin. */
  serieId: number | null
  teams: TerminDetails['teams']
  /**
   * `teilnehmerVersion`, zu der die Einteilung erzeugt wurde. Gesetzt: `veraltet` folgt
   * dem Vergleich mit der aktuellen Version (wie am Server). Ungesetzt: `teams` gilt, wie angegeben.
   */
  teamsVersion?: number
  ergebnis: TerminDetails['ergebnis']
  /** Erlaubte Läufe der Teamgenerierung je Nutzer und Kontingentstand (Vorgabe 2, wie `anzTeamGenerator`). */
  kontingent: number
  /**
   * Kontingentstand des Servers (`kontingent_version`, seit 22.10.2026; nach außen unsichtbar): steigt nur bei neuen
   * Zusagen, Skillwert- und Gast-Stufen-Änderungen, **nicht bei einer Absage**. Ungesetzt gilt `teilnehmerVersion`.
   */
  kontingentVersion?: number
  /** Bereits verbrauchte Läufe je Kontingentstand. */
  laeufe: Record<number, number>
  /** Die nachgebildete Sitzung ist der Admin: Er darf ohne Zusage generieren (`403 KEINE_ZUSAGE` sonst). */
  adminSitzung?: boolean
  /** Zeitpunkt der Hallenabsage (C8) oder ungesetzt/`null`: noch nicht abgesagt. */
  halleAbgesagtAm?: string | null
  /** Spätester Zeitpunkt der Hallenabsage (C8); ungesetzt gilt der Beginn des Termins. */
  halleAbsageMoeglichBis?: string
}

/**
 * Baut ein Terminmodell. Vorgabe: ein geplanter Termin im Jahr 2099 (nie
 * „begonnen“) mit acht Zusagen, darunter ein Gast, ohne eigene Rückmeldung.
 *
 * @param teil Abweichungen von der Vorgabe; `terminId` ist Pflicht.
 */
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
    version: 1,
    serieId: null,
    teams: null,
    ergebnis: null,
    kontingent: 2,
    laeufe: {},
    ...teil,
  }
}

/** Der Termin in der Listenansicht. */
export function uebersichtVon(modell: TerminModell): TerminUebersicht {
  return {
    terminId: modell.terminId,
    serieId: modell.serieId,
    datum: modell.datum,
    uhrzeit: modell.uhrzeit,
    ort: modell.ort,
    status: modell.status,
    teilnehmerVersion: modell.teilnehmerVersion,
    zusagen: modell.zusagen.length,
    eigeneRueckmeldung: modell.eigene,
  }
}

/**
 * Die Einzelansicht eines Termins. Die Warteschlange folgt der Reihenfolge:
 * Position über `max` heißt `wartet`; `mindestzahlErreicht` zählt alle Zusagen,
 * auch die wartenden – wie beim Server.
 */
export function detailsVon(modell: TerminModell): TerminDetails {
  return {
    ...uebersichtVon(modell),
    version: modell.version,
    teilnehmerliste: {
      minTeilnehmer: modell.min,
      maxTeilnehmer: modell.max,
      mindestzahlErreicht: modell.zusagen.length >= modell.min,
      teilnehmer: modell.zusagen.map((z, i) => ({
        position: i + 1,
        anzeigeName: z.name,
        gast: z.gast,
        wartet: i + 1 > modell.max,
      })),
    },
    teams: modell.teams
      ? {
          ...modell.teams,
          veraltet:
            modell.teamsVersion === undefined ? modell.teams.veraltet : modell.teamsVersion !== modell.teilnehmerVersion,
        }
      : null,
    ergebnis: modell.ergebnis,
    halleAbgesagtAm: modell.halleAbgesagtAm ?? null,
    halleAbsageMoeglichBis: modell.halleAbsageMoeglichBis ?? `${modell.datum}T${modell.uhrzeit.slice(0, 5)}:00`,
    kontingentGenerierung: kontingentVon(modell),
  }
}

/**
 * Restkontingent der Sitzung wie am Server (seit 22.10.2026): `null` ohne Zusage (und nicht Admin) oder bei einem
 * Termin, der nicht `GEPLANT` ist; sonst `erlaubt` und `uebrig` im aktuellen Kontingentstand.
 */
export function kontingentVon(modell: TerminModell): TerminDetails['kontingentGenerierung'] {
  if (modell.status !== 'GEPLANT' || (modell.eigene !== true && !modell.adminSitzung)) return null
  const verbraucht = modell.laeufe[modell.kontingentVersion ?? modell.teilnehmerVersion] ?? 0
  return { erlaubt: modell.kontingent, uebrig: Math.max(0, modell.kontingent - verbraucht) }
}

/**
 * Baut aus den Zusagen eine Einteilung: die ersten Zusagen in Team A, der Rest in Team B,
 * bei ungerader Zahl ist der letzte Eintrag des grösseren Teams Auswechselspieler.
 * Wartende (ab `max`) spielen nicht mit.
 */
export function teamsAus(modell: TerminModell, erzeugtVon: string = EIGENER_NAME): NonNullable<TerminDetails['teams']> {
  const spieler = modell.zusagen.slice(0, modell.max)
  const haelfte = Math.ceil(spieler.length / 2)
  const eintrag = (z: Zusage, auswechsel = false) => ({ anzeigeName: z.name, gast: z.gast, auswechselspieler: auswechsel })
  const teamA = spieler.slice(0, haelfte).map((z) => eintrag(z))
  const teamB = spieler.slice(haelfte).map((z) => eintrag(z))
  const ungerade = spieler.length % 2 === 1
  if (ungerade && teamA.length > 0) teamA[teamA.length - 1].auswechselspieler = true
  return {
    erzeugtAm: new Date().toISOString(),
    erzeugtVon,
    veraltet: false,
    auswechselspieler: ungerade ? (teamA.at(-1)?.anzeigeName ?? null) : null,
    teamA,
    teamB,
  }
}

/** Ein erfasstes Ergebnis fuer Tests der Anzeige: Team A, deutlich, unkorrigiert. */
export const beispielErgebnis: NonNullable<TerminDetails['ergebnis']> = {
  sieger: 'A',
  deutlich: true,
  erfasstVon: 'Beispielspieler 01',
  erfasstAm: '2099-01-13T21:00:00Z',
  korrigiertAm: null,
  version: 1,
}

/** Die Bilanz der Beispielsitzung: drei Siege, zwei Niederlagen, ein Unentschieden. */
export const beispielBilanz = { siege: 3, niederlagen: 2, unentschieden: 1 }

/** Einzelansicht eines Beispieltermins mit den Abweichungen des Falls (Zustandsmatrix der Tests). */
export function terminDetailsMit(teil: Partial<TerminModell> = {}): TerminDetails {
  return detailsVon(terminModell({ terminId: 102, ...teil }))
}

/** Beispieltermine für die zustandslosen Vorgaben: ein abgesagter, zwei geplante. */
export const beispielModelle: TerminModell[] = [
  terminModell({ terminId: 101, datum: '2099-01-06', status: 'ABGESAGT', zusagen: [] }),
  terminModell({ terminId: 102 }),
  terminModell({
    terminId: 103,
    datum: '2099-01-20',
    zusagen: [
      { name: 'Beispielspieler 11', gast: false },
      { name: EIGENER_NAME, gast: false },
      { name: 'Beispielspieler 12', gast: false },
    ],
    eigene: true,
  }),
]

/** Die Listenansicht der Beispieltermine. */
export const beispielTermine: TerminUebersicht[] = beispielModelle.map(uebersichtVon)

/** Was der nachgebildete Server von den Aufrufen gesehen hat. */
export type TerminProtokoll = {
  /** `X-FuBo-Kein-Refresh` je Abruf von `/termine/lesen` (Wert des Kopfes oder `null`). */
  listenabrufe: (string | null)[]
  /** Dasselbe je Abruf einer Einzelansicht. */
  detailabrufe: (string | null)[]
  /** Angefragte Stichtage (`ab`) der Listenabrufe; `null` ohne Parameter. */
  stichtage: (string | null)[]
  /** Eingegangene Rückmeldungen samt Kopf (soll `null` sein). */
  rueckmeldungen: { terminId: number; zusage: boolean; kopf: string | null }[]
  /** Eingegangene Teamgenerierungen samt Kopf (soll `null` sein). */
  generierungen: { terminId: number; kopf: string | null }[]
  /** Eingegangene Ergebnisse samt Kopf (soll `null` sein). */
  erfassungen: { terminId: number; sieger: string; deutlich: boolean; kopf: string | null }[]
  /** `X-FuBo-Kein-Refresh` je Abruf der Bilanz. */
  bilanzabrufe: (string | null)[]
}

/**
 * Zustandsbehaftete Handler für Liste, Einzelansicht und Rückmeldung.
 *
 * Wird mit `mockServer.use(...handlers)` installiert. **Eine Zusage stellt
 * hinten an** (der Eintrag wandert ans Ende), eine Absage entfernt ihn, beides
 * erhöht `teilnehmerVersion`. Ein Termin, der nicht `GEPLANT` ist oder dessen
 * Beginn zurückliegt, antwortet `409 TERMIN_GESCHLOSSEN`.
 *
 * Ohne `ab` liefert die Liste **alle** Termine, mit `ab` ab diesem Tag – wie der Server
 * (Vertrag, Stand 18.10.2026; vorher „ab heute“).
 *
 * @param modelle Die Termine der nachgebildeten Welt; Reihenfolge wie vom Server (aufsteigend).
 */
export function terminHandlers(modelle: TerminModell[] = [terminModell({ terminId: 102 })]) {
  const protokoll: TerminProtokoll = {
    listenabrufe: [],
    detailabrufe: [],
    stichtage: [],
    rueckmeldungen: [],
    generierungen: [],
    erfassungen: [],
    bilanzabrufe: [],
  }
  const bilanz = { ...beispielBilanz, siege: 0, niederlagen: 0, unentschieden: 0 }

  const handlers = [
    http.get('*/termine/lesen', ({ request }) => {
      const ab = new URL(request.url).searchParams.get('ab')
      protokoll.listenabrufe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      protokoll.stichtage.push(ab)
      const liste = ab ? modelle.filter((m) => m.datum >= ab) : modelle
      return HttpResponse.json(liste.map(uebersichtVon))
    }),

    http.get('*/termine/:terminId/lesen', ({ params, request }) => {
      protokoll.detailabrufe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      const modell = modelle.find((m) => String(m.terminId) === params.terminId)
      return modell
        ? HttpResponse.json(detailsVon(modell))
        : problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
    }),

    http.post('*/termine/rueckmeldung', async ({ request }) => {
      const { terminId, zusage } = (await request.json()) as { terminId: number; zusage: boolean }
      protokoll.rueckmeldungen.push({ terminId, zusage, kopf: request.headers.get('X-FuBo-Kein-Refresh') })
      const modell = modelle.find((m) => m.terminId === terminId)
      if (!modell) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (modell.status !== 'GEPLANT' || beginnVon(modell).getTime() <= Date.now()) {
        return problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen. Eine Rückmeldung ist nicht mehr möglich.')
      }
      modell.zusagen = modell.zusagen.filter((z) => z.name !== EIGENER_NAME || z.gast)
      if (zusage) modell.zusagen.push({ name: EIGENER_NAME, gast: false })
      modell.eigene = zusage
      modell.teilnehmerVersion += 1
      return new HttpResponse(null, { status: 204 })
    }),

    // Teamgenerierung (C5, Stufe 2). Prüfreihenfolge wie am Server: Termin, Status, Beginn,
    // Mindestzahl, Kontingent. Ein Lauf verbraucht Kontingent je `teilnehmerVersion`
    // und setzt die Einteilung samt Version, damit `veraltet` später folgt.
    http.post('*/teams/generieren', async ({ request }) => {
      const { terminId } = (await request.json()) as { terminId: number }
      protokoll.generierungen.push({ terminId, kopf: request.headers.get('X-FuBo-Kein-Refresh') })
      const modell = modelle.find((m) => m.terminId === terminId)
      if (!modell) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      // Wie am Server (seit 22.10.2026): vor dem Status, Admin oder eigene Zusage; die Warteschlange zählt mit.
      if (modell.eigene !== true && !modell.adminSitzung) {
        return problem(403, 'KEINE_ZUSAGE', 'Teams generieren darf nur, wer für diesen Termin zugesagt hat.')
      }
      if (modell.status !== 'GEPLANT') return problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen.')
      if (beginnVon(modell).getTime() <= Date.now()) {
        return problem(409, 'TEAMS_FIXIERT', 'Die Einteilung steht fest, der Termin hat begonnen.')
      }
      if (modell.zusagen.length < modell.min) {
        return problem(
          409,
          'ZU_WENIG_TEILNEHMER',
          `Es braucht mindestens ${String(modell.min)} Zusagen, aktuell ${String(modell.zusagen.length)}.`,
        )
      }
      const stand = modell.kontingentVersion ?? modell.teilnehmerVersion
      const verbraucht = modell.laeufe[stand] ?? 0
      if (verbraucht >= modell.kontingent) {
        return problem(409, 'KONTINGENT_ERSCHOEPFT', 'Das Kontingent für diese Teilnehmerliste ist aufgebraucht.')
      }
      modell.laeufe[stand] = verbraucht + 1
      modell.teams = teamsAus(modell)
      modell.teamsVersion = modell.teilnehmerVersion
      return HttpResponse.json(modell.teams, { status: 201 })
    }),

    // Ergebnis erfassen (C5, Stufe 3). Prüfreihenfolge wie am Server: Termin, Status,
    // Einteilung, eingeteilt (403, außer Admin), vorhandenes Ergebnis. **Der erste Eintrag gilt:** ein zweiter Aufruf
    // liefert `409 ERGEBNIS_VORHANDEN` und ändert nichts. Die Bilanz zählt den eigenen Ausgang.
    http.post('*/ergebnis/erfassen', async ({ request }) => {
      const { terminId, sieger, deutlich } = (await request.json()) as {
        terminId: number
        sieger: 'A' | 'B' | 'U'
        deutlich: boolean
      }
      protokoll.erfassungen.push({ terminId, sieger, deutlich, kopf: request.headers.get('X-FuBo-Kein-Refresh') })
      const modell = modelle.find((m) => m.terminId === terminId)
      if (!modell) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (modell.status !== 'ABGESCHLOSSEN') {
        return problem(409, 'TERMIN_NICHT_ABGESCHLOSSEN', `Der Termin ist ${modell.status}, ein Ergebnis ist noch nicht möglich.`)
      }
      if (!modell.teams) return problem(409, 'KEINE_EINTEILUNG', 'Für diesen Termin gibt es keine Einteilung.')
      // Wie am Server (seit 22.10.2026): nur Eingeteilte (Name und Gast-Kennzeichen der Sitzung) und der Admin.
      const eingeteilt = [...modell.teams.teamA, ...modell.teams.teamB].some((e) => e.anzeigeName === EIGENER_NAME && !e.gast)
      if (!eingeteilt && !modell.adminSitzung) {
        return problem(403, 'NICHT_EINGETEILT', 'Ein Ergebnis eintragen darf nur, wer in diesem Termin eingeteilt war.')
      }
      if (modell.ergebnis) return problem(409, 'ERGEBNIS_VORHANDEN', `Das Ergebnis wurde bereits von ${modell.ergebnis.erfasstVon} erfasst.`)
      if (sieger === 'U' && deutlich) return problem(400, 'EINGABE_UNGUELTIG', 'Bei Unentschieden ist deutlich nicht zulässig.')
      modell.ergebnis = {
        sieger,
        deutlich,
        erfasstVon: EIGENER_NAME,
        erfasstAm: new Date().toISOString(),
        korrigiertAm: null,
        version: 1,
      }
      const inA = modell.teams.teamA.some((e) => e.anzeigeName === EIGENER_NAME && !e.gast)
      const inB = modell.teams.teamB.some((e) => e.anzeigeName === EIGENER_NAME && !e.gast)
      if (inA || inB) {
        if (sieger === 'U') bilanz.unentschieden += 1
        else if ((sieger === 'A') === inA) bilanz.siege += 1
        else bilanz.niederlagen += 1
      }
      return HttpResponse.json(modell.ergebnis, { status: 201 })
    }),

    http.get('*/bilanz/lesen', ({ request }) => {
      protokoll.bilanzabrufe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      return HttpResponse.json(bilanz)
    }),
  ]

  return { handlers, modelle, protokoll, bilanz }
}
