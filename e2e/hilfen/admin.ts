import type { Page, Route } from '@playwright/test'
import { sitzungNachbilden, type Sitzung } from './sitzung.js'
import { problem, terminModell, termineNachbilden, type TerminModell, type Termine } from './termine.js'

/**
 * Nachbildung der Admin-Endpunkte fuer die E2E-Tests (ohne Server), C7.
 *
 * Baut auf `sitzungNachbilden` auf und meldet die Sitzung als Admin an (Stufe
 * `PROFILE_AUTHENTICATED`, Rolle `ADMIN`). Die Welt waechst mit den Stufen von C7:
 * Stufe 1 bildet die zentrale PIN und die Namensaenderung nach, die Stufen 2 und 3
 * ergaenzen Profile und Termine.
 *
 * **Zustandsbehaftet und zaehlend:** Jede Aenderung, die der echte Server vornimmt
 * (zentrale PIN aendern widerruft alle Sitzungen), tut die Nachbildung ebenfalls;
 * die Tests sehen so auch Aufrufe, die nicht stattfinden duerfen.
 *
 * Wird **vor** `termineNachbilden` aufgerufen: Die zuletzt angemeldete Route gewinnt
 * und ersetzt die leere Terminliste aus `sitzungNachbilden`.
 */

/** Antwort der naechsten Aenderung der zentralen PIN. */
export type PinAntwort = 'erfolg' | 'eingabe-ungueltig' | 'ausfall'

/** Antwort der naechsten Anforderung eines neuen Anmeldenamens. */
export type NameAntwort = 'erfolg' | 'belegt' | 'versand-fehlgeschlagen'

/** Antwort der naechsten Bestaetigung des Namens, von vorn verbraucht. */
export type BestaetigungsAntwort = 'erfolg' | 'pin-falsch' | 'ungueltig'

/** Ein Profil der Nachbildung (Form wie `SpielerDetails`). */
export type E2EProfil = {
  spielerId: number
  name: string
  rolle: 'USER' | 'ADMIN'
  aktiv: boolean
  belegt: boolean
  skills: Record<string, number>
  bilanz: { siege: number; niederlagen: number; unentschieden: number }
}

/** Skillkategorien der Nachbildung: vier Feldkategorien (0 bis 6) und Torwart (0 bis 3); Beispielschluessel. */
export const E2E_KATEGORIEN = [
  { schluessel: 'ANGRIFF', bezeichnung: 'Angriff', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 6 },
  { schluessel: 'VERTEIDIGUNG', bezeichnung: 'Verteidigung', gewicht: 1, reihenfolge: 2, minWert: 0, maxWert: 6 },
  { schluessel: 'SPIELSTAERKE', bezeichnung: 'Spielstärke', gewicht: 1, reihenfolge: 3, minWert: 0, maxWert: 6 },
  { schluessel: 'LAUFSTAERKE', bezeichnung: 'Laufstärke', gewicht: 1, reihenfolge: 4, minWert: 0, maxWert: 6 },
  { schluessel: 'TORWART', bezeichnung: 'Torwart', gewicht: 0.3, reihenfolge: 5, minWert: 0, maxWert: 3 },
]

/** Baut ein Profil; Vorgabe: Spieler, aktiv, nicht online, vollstaendige Karte, Bilanz 0/0/0. */
export function e2eProfil(teil: Partial<E2EProfil> & { spielerId: number; name: string }): E2EProfil {
  return {
    rolle: 'USER',
    aktiv: true,
    belegt: false,
    skills: { ANGRIFF: 3, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 },
    bilanz: { siege: 0, niederlagen: 0, unentschieden: 0 },
    ...teil,
  }
}

/** Beobachtbarer Stand der nachgebildeten Admin-Endpunkte. */
export type AdminWelt = {
  sitzung: Sitzung
  /** Wie die naechste Aenderung der zentralen PIN ausgeht; `erfolg` ist die Vorgabe. */
  pinAntwort: PinAntwort
  /** Gesendete neue PINs, in Reihenfolge. */
  neuePins: string[]
  /** Wie die naechste Anforderung eines Namens ausgeht. */
  nameAntwort: NameAntwort
  /** Angeforderte Namen, in Reihenfolge. */
  angeforderteNamen: string[]
  /** Antworten der naechsten Bestaetigungen, von vorn verbraucht (leer: Erfolg). */
  bestaetigungen: BestaetigungsAntwort[]
  /** Gesendete Bestaetigungs-PINs, in Reihenfolge. */
  bestaetigungsPins: string[]
  /** Profile in Serverreihenfolge: Spieler vorn, das Adminprofil am Ende (Stufe 2). */
  profile: E2EProfil[]
  /** Ids von Profilen mit fachlichen Daten (`409 PROFIL_IN_VERWENDUNG` beim Entfernen). */
  inVerwendung: Set<number>
  /** Eingegangene Koerper der Profil-Schreibaufrufe, in Reihenfolge. */
  profilKoerper: { angelegt: unknown[]; bearbeitet: unknown[]; blockiert: unknown[]; entfernt: unknown[] }
}

/** Die Beispielprofile: Spieler 1 bis 3 (einer gesperrt, einer online) und das Adminprofil. */
export function beispielProfile(): E2EProfil[] {
  return [
    e2eProfil({ spielerId: 1, name: 'Beispielspieler 01' }),
    e2eProfil({ spielerId: 2, name: 'Beispielspieler 02', aktiv: false }),
    e2eProfil({ spielerId: 3, name: 'Beispielspieler 03', belegt: true }),
    e2eProfil({
      spielerId: 99,
      name: 'Beispieladmin',
      rolle: 'ADMIN',
      skills: { ANGRIFF: 0, VERTEIDIGUNG: 0, SPIELSTAERKE: 0, LAUFSTAERKE: 0, TORWART: 0 },
    }),
  ]
}

/** Problemantwort mit Feldmeldungen (`400 EINGABE_UNGUELTIG`). */
function eingabeUngueltig(route: Route, felder: Record<string, string>) {
  return route.fulfill({
    status: 400,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', status: 400, code: 'EINGABE_UNGUELTIG', detail: 'Die Eingabe ist ungültig.', felder },
  })
}

/**
 * Bildet Sitzung (Admin) und die Endpunkte der Stufe 1 nach.
 *
 * @param start Anfangszustand der Sitzung (Vorgabe: Admin, 900 s Leerlauf).
 */
export async function adminNachbilden(page: Page, start: Partial<Sitzung> = {}): Promise<AdminWelt> {
  const sitzung = await sitzungNachbilden(page, {
    leerlaufSek: 900,
    stage: 'PROFILE_AUTHENTICATED',
    rolle: 'ADMIN',
    ...start,
  })
  const welt: AdminWelt = {
    sitzung,
    pinAntwort: 'erfolg',
    neuePins: [],
    nameAntwort: 'erfolg',
    angeforderteNamen: [],
    bestaetigungen: [],
    bestaetigungsPins: [],
    profile: beispielProfile(),
    inVerwendung: new Set<number>(),
    profilKoerper: { angelegt: [], bearbeitet: [], blockiert: [], entfernt: [] },
  }

  await page.route('**/api/v1/admin/pin/aendern', (route) => {
    welt.neuePins.push((route.request().postDataJSON() as { neuePin: string }).neuePin)
    if (welt.pinAntwort === 'ausfall') return problem(route, 500, 'INTERNER_FEHLER', 'Es ist ein interner Fehler aufgetreten.')
    if (welt.pinAntwort === 'eingabe-ungueltig') {
      return eingabeUngueltig(route, { neuePin: 'Die PIN muss aus genau vier Ziffern bestehen.' })
    }
    // Wie der Server: alle Sitzungen widerrufen, auch die des Admins.
    sitzung.angemeldet = false
    return route.fulfill({ status: 204 })
  })

  await page.route('**/api/v1/admin/name/aendern', (route) => {
    welt.angeforderteNamen.push((route.request().postDataJSON() as { neuerName: string }).neuerName)
    if (welt.nameAntwort === 'belegt') return problem(route, 409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.')
    if (welt.nameAntwort === 'versand-fehlgeschlagen') {
      return problem(route, 503, 'VERSAND_FEHLGESCHLAGEN', 'Die E-Mail konnte nicht gesendet werden.')
    }
    return route.fulfill({ status: 202 })
  })

  await page.route('**/api/v1/admin/name/bestaetigen', (route) => {
    welt.bestaetigungsPins.push((route.request().postDataJSON() as { bestaetigungsPin: string }).bestaetigungsPin)
    const antwort = welt.bestaetigungen.shift() ?? 'erfolg'
    if (antwort === 'pin-falsch') return problem(route, 401, 'NAME_PIN_FALSCH', 'Die PIN ist nicht korrekt. Noch 4 Versuche.')
    if (antwort === 'ungueltig') {
      return problem(route, 409, 'NAME_AENDERUNG_UNGUELTIG', 'Die Anforderung ist abgelaufen. Bitte fordere eine neue PIN an.')
    }
    return route.fulfill({ status: 204 })
  })

  await profileNachbilden(page, welt)
  return welt
}

/** Eine Problemantwort ueber die gemeinsame Hilfe, fuer die Profile. */
const nichtGefunden = (route: Route) => problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Das Profil wurde nicht gefunden.')

/** Bildet die sechs Profil-Endpunkte (Stufe 2) auf dem Zustand der Welt nach. */
async function profileNachbilden(page: Page, welt: AdminWelt) {
  const finden = (id: unknown) => welt.profile.find((p) => p.spielerId === id)
  const belegt = (name: string, ausser?: number) =>
    welt.profile.some((p) => p.spielerId !== ausser && p.name.toLowerCase() === name.toLowerCase())

  await page.route('**/api/v1/admin/user/lesen', (route) => route.fulfill({ json: welt.profile }))
  await page.route('**/api/v1/admin/skills/lesen', (route) => route.fulfill({ json: E2E_KATEGORIEN }))

  await page.route('**/api/v1/admin/user/anlegen', (route) => {
    const koerper = route.request().postDataJSON() as { name: string; skills: Record<string, number> }
    welt.profilKoerper.angelegt.push(koerper)
    if (belegt(koerper.name.trim())) return problem(route, 409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.')
    const id = Math.max(...welt.profile.map((p) => p.spielerId)) + 1
    const profil = e2eProfil({ spielerId: id, name: koerper.name.trim(), skills: { ...koerper.skills } })
    welt.profile.splice(welt.profile.length - 1, 0, profil)
    return route.fulfill({ status: 201, json: { spielerId: id, name: profil.name } })
  })

  await page.route('**/api/v1/admin/user/bearbeiten', (route) => {
    const koerper = route.request().postDataJSON() as { spielerId: number; name?: string; skills?: Record<string, number> }
    welt.profilKoerper.bearbeitet.push(koerper)
    const profil = finden(koerper.spielerId)
    if (!profil) return nichtGefunden(route)
    if (koerper.name !== undefined && belegt(koerper.name.trim(), profil.spielerId)) {
      return problem(route, 409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.')
    }
    if (koerper.name !== undefined) profil.name = koerper.name.trim()
    if (koerper.skills) profil.skills = { ...profil.skills, ...koerper.skills }
    return route.fulfill({ status: 204 })
  })

  await page.route('**/api/v1/admin/user/blockieren', (route) => {
    const koerper = route.request().postDataJSON() as { spielerId: number; blockieren: boolean }
    welt.profilKoerper.blockiert.push(koerper)
    const profil = finden(koerper.spielerId)
    if (!profil) return nichtGefunden(route)
    profil.aktiv = !koerper.blockieren
    // Wie am Server: Mit der Sperre endet die Sitzung des Spielers.
    if (koerper.blockieren) profil.belegt = false
    return route.fulfill({ status: 204 })
  })

  await page.route('**/api/v1/admin/user/entfernen', (route) => {
    const koerper = route.request().postDataJSON() as { spielerId: number }
    welt.profilKoerper.entfernt.push(koerper)
    const profil = finden(koerper.spielerId)
    if (!profil) return nichtGefunden(route)
    if (welt.inVerwendung.has(profil.spielerId)) {
      return problem(route, 409, 'PROFIL_IN_VERWENDUNG', 'Das Profil hat bereits Daten und lässt sich nicht entfernen.')
    }
    welt.profile = welt.profile.filter((p) => p.spielerId !== profil.spielerId)
    return route.fulfill({ status: 204 })
  })
}

/** Eingegangene Koerper der Termin-Schreibaufrufe, in Reihenfolge (Stufe 3). */
export type TerminKoerper = { angelegt: unknown[]; serien: unknown[]; geaendert: unknown[]; abgesagt: unknown[]; entfernt: unknown[] }

/** Beobachtbarer Stand der nachgebildeten Terminverwaltung. */
export type TerminVerwaltung = {
  koerper: TerminKoerper
  /** Ids von Terminen, an denen Daten haengen (`409 TERMIN_IN_VERWENDUNG`); Zusagen, Teams und Ergebnis zaehlen immer. */
  inVerwendung: Set<number>
  /** Eine zweite Person aendert den Termin: `version` zaehlt hoch, die Felder aendern sich. */
  fremdeAenderung: (terminId: number, aenderung: Partial<Pick<TerminModell, 'datum' | 'uhrzeit' | 'ort' | 'status'>>) => void
}

const normal = (uhrzeit: string) => (uhrzeit.length === 5 ? `${uhrzeit}:00` : uhrzeit)
const sortieren = (modelle: TerminModell[]) => modelle.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit))
const beginn = (datum: string, uhrzeit: string) => new Date(`${datum}T${normal(uhrzeit)}`).getTime()

/** Tage von `start` bis `ende` einschliesslich, als `YYYY-MM-DD`. */
function tage(start: string, ende: string): string[] {
  const zwei = (n: number) => String(n).padStart(2, '0')
  const [j, m, t] = start.split('-').map(Number)
  const liste: string[] = []
  for (let d = new Date(j, m - 1, t, 12); ; d.setDate(d.getDate() + 1)) {
    const iso = `${String(d.getFullYear())}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
    if (iso > ende) return liste
    liste.push(iso)
  }
}

/** ISO-Wochentag (1 = Montag bis 7 = Sonntag) eines Datums. */
function wochentag(datum: string): number {
  const [j, m, t] = datum.split('-').map(Number)
  return new Date(j, m - 1, t, 12).getDay() || 7
}

/**
 * Bildet die fuenf Termin-Schreibaufrufe (Stufe 3) auf den Modellen von `termineNachbilden` nach.
 * Wird **nach** `termineNachbilden` aufgerufen und aendert dessen `modelle` an Ort und Stelle; die
 * Lese-Endpunkte sehen so jede Aenderung.
 */
export async function terminverwaltungNachbilden(page: Page, termine: Termine): Promise<TerminVerwaltung> {
  const modelle = termine.modelle
  const verwaltung: TerminVerwaltung = {
    koerper: { angelegt: [], serien: [], geaendert: [], abgesagt: [], entfernt: [] },
    inVerwendung: new Set<number>(),
    fremdeAenderung: (terminId, aenderung) => {
      const modell = modelle.find((t) => t.terminId === terminId)
      if (!modell) throw new Error(`Termin ${String(terminId)} fehlt`)
      Object.assign(modell, aenderung)
      modell.version += 1
      sortieren(modelle)
    },
  }
  let naechsteId = Math.max(100, ...modelle.map((t) => t.terminId)) + 1
  let naechsteSerie = 1
  const belegt = (datum: string, uhrzeit: string, ausser?: number) =>
    modelle.some((t) => t.terminId !== ausser && t.datum === datum && normal(t.uhrzeit) === normal(uhrzeit))
  const nichtGefunden = (route: Route) => problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
  const neu = (datum: string, uhrzeit: string, ort: string | undefined, serieId: number | null) => {
    const modell = terminModell({
      terminId: naechsteId,
      datum,
      uhrzeit: normal(uhrzeit),
      ort: ort?.trim() ? ort.trim() : null,
      zusagen: [],
      serieId,
    })
    naechsteId += 1
    modelle.push(modell)
    return modell
  }

  await page.route('**/api/v1/admin/termin/anlegen', (route) => {
    const k = route.request().postDataJSON() as { datum: string; uhrzeit: string; ort?: string }
    verwaltung.koerper.angelegt.push(k)
    if (beginn(k.datum, k.uhrzeit) <= Date.now()) {
      return problem(route, 400, 'EINGABE_UNGUELTIG', 'Der Termin darf nicht in der Vergangenheit liegen.')
    }
    if (belegt(k.datum, k.uhrzeit)) return problem(route, 409, 'TERMIN_BELEGT', 'Zu diesem Zeitpunkt gibt es bereits einen Termin.')
    const modell = neu(k.datum, k.uhrzeit, k.ort, null)
    sortieren(modelle)
    return route.fulfill({ status: 201, json: { terminId: modell.terminId, datum: modell.datum, uhrzeit: modell.uhrzeit } })
  })

  await page.route('**/api/v1/admin/serie/anlegen', (route) => {
    const k = route.request().postDataJSON() as {
      titel: string
      wochentag: number
      uhrzeit: string
      startdatum: string
      enddatum: string
      ort?: string
    }
    verwaltung.koerper.serien.push(k)
    const tageListe = tage(k.startdatum, k.enddatum).filter((t) => wochentag(t) === k.wochentag)
    if (tageListe.length === 0 || k.enddatum <= k.startdatum) {
      return problem(route, 400, 'EINGABE_UNGUELTIG', 'Im Zeitraum liegt kein passender Wochentag.')
    }
    const serieId = naechsteSerie
    naechsteSerie += 1
    const angelegt: { terminId: number; datum: string; uhrzeit: string }[] = []
    const uebersprungen: string[] = []
    for (const tag of tageListe) {
      if (belegt(tag, k.uhrzeit)) {
        uebersprungen.push(tag)
        continue
      }
      const modell = neu(tag, k.uhrzeit, k.ort, serieId)
      angelegt.push({ terminId: modell.terminId, datum: modell.datum, uhrzeit: modell.uhrzeit })
    }
    sortieren(modelle)
    return route.fulfill({
      status: 201,
      json: { serieId, titel: k.titel.trim(), angelegteTermine: angelegt, uebersprungeneTermine: uebersprungen },
    })
  })

  await page.route('**/api/v1/admin/termin/aendern', (route) => {
    const k = route.request().postDataJSON() as {
      terminId: number
      version: number
      datum?: string
      uhrzeit?: string
      ort?: string
      status?: TerminModell['status']
    }
    verwaltung.koerper.geaendert.push(k)
    const modell = modelle.find((t) => t.terminId === k.terminId)
    if (!modell) return nichtGefunden(route)
    if (modell.status !== 'GEPLANT') return problem(route, 409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist nicht mehr geplant.')
    if (k.version !== modell.version) return problem(route, 409, 'DATEN_VERALTET', 'Der Datensatz wurde zwischenzeitlich geaendert.')
    const datum = k.datum ?? modell.datum
    const uhrzeit = k.uhrzeit ? normal(k.uhrzeit) : modell.uhrzeit
    if ((k.datum || k.uhrzeit) && belegt(datum, uhrzeit, modell.terminId)) {
      return problem(route, 409, 'TERMIN_BELEGT', 'Zu diesem Zeitpunkt gibt es bereits einen Termin.')
    }
    modell.datum = datum
    modell.uhrzeit = uhrzeit
    if (k.ort !== undefined) modell.ort = k.ort.trim() === '' ? null : k.ort.trim()
    if (k.status) modell.status = k.status
    modell.version += 1
    sortieren(modelle)
    return route.fulfill({ status: 204 })
  })

  await page.route('**/api/v1/admin/termin/absagen', (route) => {
    const k = route.request().postDataJSON() as { terminId: number }
    verwaltung.koerper.abgesagt.push(k)
    const modell = modelle.find((t) => t.terminId === k.terminId)
    if (!modell) return nichtGefunden(route)
    if (modell.status !== 'GEPLANT') return problem(route, 409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist nicht mehr geplant.')
    modell.status = 'ABGESAGT'
    modell.version += 1
    return route.fulfill({ status: 204 })
  })

  await page.route('**/api/v1/admin/termin/entfernen', (route) => {
    const k = route.request().postDataJSON() as { terminId: number }
    verwaltung.koerper.entfernt.push(k)
    const index = modelle.findIndex((t) => t.terminId === k.terminId)
    if (index === -1) return nichtGefunden(route)
    const modell = modelle[index]
    if (modell.zusagen.length > 0 || modell.teams || modell.ergebnis || verwaltung.inVerwendung.has(modell.terminId)) {
      return problem(route, 409, 'TERMIN_IN_VERWENDUNG', 'Am Termin haengen Rueckmeldungen oder Teams.')
    }
    modelle.splice(index, 1)
    return route.fulfill({ status: 204 })
  })

  return verwaltung
}

/** Die Konfiguration der Nachbildung (Form wie `Konfiguration`), ohne den nur lesbaren `halleAbsageVorlageEffektiv`. */
export type E2EKonfiguration = {
  minTeilnehmer: number
  maxTeilnehmer: number
  anzGuests: number
  algorithmType: 'EXHAUSTIV' | 'HEURISTIK'
  auswechselModus: 'SCHWAECHSTER_UEBERZAHL' | 'ZULETZT_ANGEMELDET'
  anzTeamGenerator: number
  sessionLeerlaufMinuten: number
  sessionMaximalStunden: number
  halleEmail: string | null
  halleAbsageVorlage: string | null
  halleVorlaufStunden: number
  hallenModusAktiv: boolean
  pushAktiv: boolean
  pushErinnerungStunden: number
  geaendertAm: string
  version: number
}

/** Ein Gastplatz der Nachbildung (Form wie `GastPlatzInfo`). */
export type E2EGastPlatz = {
  nummer: number
  anzeigeName: string
  wirksam: boolean
  belegt: boolean
  belegtSeit?: string | null
  gastName?: string | null
  gastStufe?: 'STARK' | 'MITTEL' | 'SCHWACH' | null
  sitzungGueltig?: boolean | null
}

/** Beobachtbarer Stand der nachgebildeten Konfiguration, Gastplätze, Gast-Stufe, Halle, Ergebniskorrektur und manuellen Teams (C8). */
export type KonfigurationWelt = {
  konfiguration: E2EKonfiguration
  gastplaetze: E2EGastPlatz[]
  /** Eingegangene Koerper der Schreibaufrufe, in Reihenfolge. */
  koerper: {
    geaendert: Record<string, unknown>[]
    freigegeben: Record<string, unknown>[]
    gastStufen: Record<string, unknown>[]
    /** Koerper von `/admin/teilnahme/gast-absagen` (Vertragsvorschlag vom 24.10.2026). */
    gastAbgesagt: Record<string, unknown>[]
    halleAbgesagt: Record<string, unknown>[]
    ergebnisKorrigiert: Record<string, unknown>[]
    teamsManuell: Record<string, unknown>[]
  }
  /** `X-FuBo-Kein-Refresh` je Lesen (Wert des Kopfes oder `null`). */
  abrufe: { konfiguration: (string | null)[]; gaeste: (string | null)[] }
  /** Gesetzt: Der Versand der Hallenabsage scheitert mit `503`, und es bleibt nichts zurueck. */
  mailFehler: boolean
  /** Eine zweite Person aendert die Konfiguration: `version` zaehlt hoch. */
  fremdeAenderung: (aenderung?: Partial<Omit<E2EKonfiguration, 'version'>>) => void
  /** Eine zweite Person korrigiert das Ergebnis eines Termins: `version` zaehlt hoch. */
  fremdeErgebnisAenderung: (terminId: number, aenderung?: { sieger?: 'A' | 'B' | 'U'; deutlich?: boolean }) => void
}

/** Die Ersatzvorlage des Servers fuer die Hallenabsage (Beispieltext). */
export const E2E_ABSAGEVORLAGE = 'Guten Tag, wir müssen den Termin leider absagen.'

/** Die Vorgaben des Servers; Hallenmodus aus, keine Adresse. */
export function e2eKonfiguration(teil: Partial<E2EKonfiguration> = {}): E2EKonfiguration {
  return {
    minTeilnehmer: 6,
    maxTeilnehmer: 22,
    anzGuests: 4,
    algorithmType: 'EXHAUSTIV',
    auswechselModus: 'SCHWAECHSTER_UEBERZAHL',
    anzTeamGenerator: 1,
    sessionLeerlaufMinuten: 15,
    sessionMaximalStunden: 1,
    halleEmail: null,
    halleAbsageVorlage: null,
    halleVorlaufStunden: 48,
    hallenModusAktiv: false,
    pushAktiv: true,
    pushErinnerungStunden: 24,
    geaendertAm: '2099-01-01T10:00:00Z',
    version: 1,
    ...teil,
  }
}

/** Vier Plaetze: 1 belegt mit lebender Sitzung (`Beispielgast`), 2 verwaist, 3 und 4 frei. */
export function e2eGastplaetze(): E2EGastPlatz[] {
  const frei = (nummer: number): E2EGastPlatz => ({ nummer, anzeigeName: `Gast ${String(nummer)}`, wirksam: true, belegt: false })
  return [
    {
      ...frei(1),
      belegt: true,
      belegtSeit: '2099-01-13T18:00:00Z',
      gastName: 'Beispielgast',
      gastStufe: 'STARK',
      sitzungGueltig: true,
    },
    {
      ...frei(2),
      belegt: true,
      belegtSeit: '2099-01-12T18:00:00Z',
      gastName: 'Beispielgast Zwei',
      gastStufe: 'SCHWACH',
      sitzungGueltig: false,
    },
    frei(3),
    frei(4),
  ]
}

const KONFIGURATION_PFLICHT = [
  'version',
  'minTeilnehmer',
  'maxTeilnehmer',
  'anzGuests',
  'algorithmType',
  'auswechselModus',
  'anzTeamGenerator',
  'sessionLeerlaufMinuten',
  'sessionMaximalStunden',
  'halleEmail',
  'halleAbsageVorlage',
  'halleVorlaufStunden',
  'hallenModusAktiv',
  'pushAktiv',
  'pushErinnerungStunden',
] as const

/**
 * Bildet Konfiguration, Gastplaetze und die Gast-Stufe (Stufe 4) nach. Wird **nach** `termineNachbilden` aufgerufen:
 * Die Stufe aendert die `zusagen` der Termine an Ort und Stelle und erhoeht die `teilnehmerVersion`.
 */
export async function konfigurationNachbilden(
  page: Page,
  termine: Termine,
  start: { konfiguration?: Partial<E2EKonfiguration>; admin?: AdminWelt } = {},
): Promise<KonfigurationWelt> {
  const welt: KonfigurationWelt = {
    konfiguration: e2eKonfiguration(start.konfiguration),
    gastplaetze: e2eGastplaetze(),
    koerper: { geaendert: [], freigegeben: [], gastStufen: [], gastAbgesagt: [], halleAbgesagt: [], ergebnisKorrigiert: [], teamsManuell: [] },
    abrufe: { konfiguration: [], gaeste: [] },
    mailFehler: false,
    fremdeAenderung: (aenderung = {}) => {
      Object.assign(welt.konfiguration, aenderung)
      welt.konfiguration.version += 1
    },
    fremdeErgebnisAenderung: (terminId, aenderung = {}) => {
      const modell = termine.modelle.find((t) => t.terminId === terminId)
      if (!modell?.ergebnis) throw new Error(`Termin ${String(terminId)} hat kein Ergebnis`)
      modell.ergebnis = { ...modell.ergebnis, ...aenderung, korrigiertAm: new Date().toISOString(), version: modell.ergebnis.version + 1 }
    },
  }

  await page.route('**/api/v1/admin/config/lesen', (route) => {
    welt.abrufe.konfiguration.push(route.request().headers()['x-fubo-kein-refresh'] ?? null)
    return route.fulfill({
      json: { ...welt.konfiguration, halleAbsageVorlageEffektiv: welt.konfiguration.halleAbsageVorlage ?? E2E_ABSAGEVORLAGE },
    })
  })

  // Voll-Update wie am Server: fehlendes Pflichtfeld ⇒ 400 mit `felder`, abweichende `version` ⇒ 409.
  await page.route('**/api/v1/admin/config/aendern', (route) => {
    const k = route.request().postDataJSON() as Record<string, unknown>
    welt.koerper.geaendert.push(k)
    const fehlend = KONFIGURATION_PFLICHT.filter((feld) => k[feld] === undefined)
    if (fehlend.length > 0) return eingabeUngueltig(route, Object.fromEntries(fehlend.map((feld) => [feld, 'Pflichtfeld.'])))
    if (k.version !== welt.konfiguration.version) {
      return problem(route, 409, 'DATEN_VERALTET', 'Die Konfiguration wurde zwischenzeitlich geändert.')
    }
    if ((k.maxTeilnehmer as number) < (k.minTeilnehmer as number)) {
      return eingabeUngueltig(route, { maxTeilnehmer: 'Die Höchstzahl darf nicht unter der Mindestzahl liegen.' })
    }
    for (const feld of KONFIGURATION_PFLICHT) {
      if (feld !== 'version') (welt.konfiguration as Record<string, unknown>)[feld] = k[feld]
    }
    welt.konfiguration.version += 1
    return route.fulfill({ status: 204 })
  })

  await page.route('**/api/v1/admin/gast/lesen', (route) => {
    welt.abrufe.gaeste.push(route.request().headers()['x-fubo-kein-refresh'] ?? null)
    return route.fulfill({ json: welt.gastplaetze })
  })

  await page.route('**/api/v1/admin/gast/freigeben', (route) => {
    const k = route.request().postDataJSON() as { slotIds?: number[]; alle?: boolean }
    welt.koerper.freigegeben.push(k)
    const nummern = k.alle ? welt.gastplaetze.filter((p) => p.belegt).map((p) => p.nummer) : (k.slotIds ?? [])
    welt.gastplaetze = welt.gastplaetze.map((p) =>
      nummern.includes(p.nummer) ? { nummer: p.nummer, anzeigeName: p.anzeigeName, wirksam: p.wirksam, belegt: false } : p,
    )
    return route.fulfill({ status: 204 })
  })

  // Gast absagen (Vertragsvorschlag vom 24.10.2026): wirkt wie die Absage des Gastes, Kontingent bleibt.
  await page.route('**/api/v1/admin/teilnahme/gast-absagen', (route) => {
    const k = route.request().postDataJSON() as { terminId: number; gastName: string }
    welt.koerper.gastAbgesagt.push(k)
    const modell = termine.modelle.find((t) => t.terminId === k.terminId)
    const zusage = modell?.zusagen.find((z) => z.gast && z.name === k.gastName)
    if (!modell || !zusage) {
      return problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Für diesen Termin liegt keine Zusage dieses Gastes vor.')
    }
    if (modell.status !== 'GEPLANT') return problem(route, 409, 'TERMIN_GESCHLOSSEN', 'Der Termin nimmt keine Rückmeldungen mehr an.')
    modell.zusagen = modell.zusagen.filter((z) => z !== zusage)
    modell.kontingentVersion ??= modell.teilnehmerVersion
    modell.teilnehmerVersion += 1
    return route.fulfill({ status: 204 })
  })

  await page.route('**/api/v1/admin/teilnahme/gast-stufe', (route) => {
    const k = route.request().postDataJSON() as { terminId: number; gastName: string; stufe: 'STARK' | 'MITTEL' | 'SCHWACH' }
    welt.koerper.gastStufen.push(k)
    const modell = termine.modelle.find((t) => t.terminId === k.terminId)
    const zusage = modell?.zusagen.find((z) => z.gast && z.name === k.gastName)
    if (!modell || !zusage) {
      return problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Für diesen Termin liegt keine Teilnahme dieses Gastes vor.')
    }
    modell.teilnehmerVersion += 1
    return route.fulfill({ status: 204 })
  })

  // Hallenabsage: Pruefung wie am Server (Modus, Termin, Status, Frist, Adresse, bereits abgesagt), dann Versand.
  await page.route('**/api/v1/admin/halle/absagen', (route) => {
    const k = route.request().postDataJSON() as { terminId: number }
    welt.koerper.halleAbgesagt.push(k)
    if (!welt.konfiguration.hallenModusAktiv) return problem(route, 409, 'HALLE_MODUS_INAKTIV', 'Der Hallenmodus ist abgeschaltet.')
    const modell = termine.modelle.find((t) => t.terminId === k.terminId)
    if (!modell) return problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
    if (modell.status === 'ABGESCHLOSSEN') return problem(route, 409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist ABGESCHLOSSEN.')
    const bis = modell.halleAbsageMoeglichBis ?? `${modell.datum}T${modell.uhrzeit.slice(0, 5)}:00`
    if (Date.now() >= Date.parse(bis)) {
      return problem(route, 409, 'HALLE_FRIST_ABGELAUFEN', `Die Absage ist nur bis ${bis} möglich.`)
    }
    if (!welt.konfiguration.halleEmail) {
      return problem(route, 409, 'HALLE_NICHT_KONFIGURIERT', 'Es ist keine E-Mail-Adresse des Hallenbetreibers hinterlegt.')
    }
    if (modell.halleAbgesagtAm) {
      return problem(route, 409, 'HALLE_BEREITS_ABGESAGT', `Die Absage ging bereits am ${modell.halleAbgesagtAm} hinaus.`)
    }
    if (welt.mailFehler) return problem(route, 503, 'VERSAND_FEHLGESCHLAGEN', 'Die E-Mail konnte nicht gesendet werden.')
    modell.halleAbgesagtAm = new Date().toISOString()
    modell.status = 'ABGESAGT'
    modell.version += 1
    return route.fulfill({ status: 204 })
  })

  // Ergebniskorrektur: Voll-Update; abweichende `version` ⇒ 409, `deutlich` bei `U` ⇒ 400.
  await page.route('**/api/v1/admin/ergebnis/korrigieren', (route) => {
    const k = route.request().postDataJSON() as { terminId: number; sieger: 'A' | 'B' | 'U'; deutlich: boolean; version: number }
    welt.koerper.ergebnisKorrigiert.push(k)
    const modell = termine.modelle.find((t) => t.terminId === k.terminId)
    if (!modell?.ergebnis) return problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Für diesen Termin liegt kein Ergebnis vor.')
    if (k.sieger === 'U' && k.deutlich) return eingabeUngueltig(route, { deutlich: 'Bei einem Unentschieden nicht möglich.' })
    if (k.version !== modell.ergebnis.version) {
      return problem(route, 409, 'DATEN_VERALTET', 'Das Ergebnis wurde zwischenzeitlich korrigiert.')
    }
    modell.ergebnis = {
      ...modell.ergebnis,
      sieger: k.sieger,
      deutlich: k.deutlich,
      korrigiertAm: new Date().toISOString(),
      version: modell.ergebnis.version + 1,
    }
    return route.fulfill({ status: 204 })
  })

  // Manuelle Teamgenerierung: Zahl gegen die Konfiguration, unvollstaendige Skillkarte ⇒ 409. Gerechnet wird zum Schein.
  await page.route('**/api/v1/admin/teams/generieren', (route) => {
    const k = route.request().postDataJSON() as { spielerIds?: number[]; gaeste?: { name?: string | null; stufe: string }[] }
    welt.koerper.teamsManuell.push(k)
    const profile = start.admin?.profile ?? beispielProfile()
    const gewaehlt: E2EProfil[] = []
    for (const id of k.spielerIds ?? []) {
      const profil = profile.find((p) => p.spielerId === id)
      if (!profil || !profil.aktiv) return eingabeUngueltig(route, { spielerIds: `Das Profil ${String(id)} ist unbekannt oder gesperrt.` })
      if (profil.rolle === 'ADMIN') return problem(route, 409, 'PROFIL_GESCHUETZT', 'Das Adminprofil kann nicht eingeteilt werden.')
      gewaehlt.push(profil)
    }
    const gaeste = k.gaeste ?? []
    const anzahl = gewaehlt.length + gaeste.length
    const { minTeilnehmer, maxTeilnehmer } = welt.konfiguration
    if (anzahl < minTeilnehmer) {
      return problem(route, 409, 'ZU_WENIG_TEILNEHMER', `Es braucht mindestens ${String(minTeilnehmer)} Teilnehmer, ausgewählt sind ${String(anzahl)}.`)
    }
    if (anzahl > maxTeilnehmer) {
      return problem(route, 409, 'ZU_VIELE_TEILNEHMER', `Es sind höchstens ${String(maxTeilnehmer)} Teilnehmer erlaubt, ausgewählt sind ${String(anzahl)}.`)
    }
    const luecke = gewaehlt.filter((p) => E2E_KATEGORIEN.some((kat) => p.skills[kat.schluessel] === undefined))
    if (luecke.length > 0) {
      return problem(route, 409, 'SKILLWERTE_UNVOLLSTAENDIG', `Die Skillwerte von ${luecke.map((p) => p.name).join(', ')} sind unvollständig.`)
    }
    const namen = [
      ...gewaehlt.map((p) => ({ anzeigeName: p.name, gast: false })),
      ...gaeste.map((g, i) => ({ anzeigeName: g.name?.trim() ? g.name.trim() : `Gast ${String(i + 1)}`, gast: true })),
    ]
    const haelfte = Math.ceil(namen.length / 2)
    const teamA = namen.slice(0, haelfte).map((n) => ({ ...n, auswechselspieler: false }))
    const teamB = namen.slice(haelfte).map((n) => ({ ...n, auswechselspieler: false }))
    const ungerade = namen.length % 2 === 1
    if (ungerade) teamA[teamA.length - 1].auswechselspieler = true
    return route.fulfill({
      json: {
        algorithmType: welt.konfiguration.algorithmType,
        auswechselModus: 'SCHWAECHSTER_UEBERZAHL',
        auswechselspieler: ungerade ? teamA[teamA.length - 1].anzeigeName : null,
        differenzTeamstaerke: 1.25,
        teamA,
        teamB,
      },
    })
  })

  return welt
}

/** Breite, um die die Seite ueber das Fenster hinausragt (0 = kein seitliches Scrollen). */
export async function ueberhangHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/**
 * Startet die Admin-Welt der C8-Specs: Sitzung (Admin), Profile, Termine, Terminverwaltung, Konfiguration, Gastplaetze,
 * Halle, Ergebniskorrektur und manuelle Teams; danach oeffnet sie `pfad`. Ohne Angabe gibt es einen geplanten Termin 1.
 */
export async function adminStart(
  page: Page,
  pfad: string,
  optionen: { modelle?: TerminModell[]; konfiguration?: Partial<E2EKonfiguration>; zusatzProfile?: E2EProfil[] } = {},
) {
  const admin = await adminNachbilden(page)
  // Zusaetzliche Spielerprofile stehen vor dem Adminprofil (Serverreihenfolge).
  if (optionen.zusatzProfile) admin.profile.splice(admin.profile.length - 1, 0, ...optionen.zusatzProfile)
  const termine = await termineNachbilden(page, optionen.modelle ?? [terminModell({ terminId: 1, datum: '2099-01-13', uhrzeit: '19:00:00' })])
  await terminverwaltungNachbilden(page, termine)
  const welt = await konfigurationNachbilden(page, termine, { konfiguration: optionen.konfiguration, admin })
  await page.goto(pfad)
  return { admin, termine, welt }
}
