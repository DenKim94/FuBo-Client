import type { Page, Route } from '@playwright/test'
import { sitzungNachbilden, type Sitzung } from './sitzung.js'
import { problem, terminModell, type TerminModell, type Termine } from './termine.js'

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
