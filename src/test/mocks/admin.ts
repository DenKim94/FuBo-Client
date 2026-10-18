import { HttpResponse, http } from 'msw'
import type { components } from '@/api/common/types/schema'
import { beginnVon } from '@/api/termine/terminZeit'
import { problem } from './problem'
import { terminModell, type TerminModell } from './termine'

type SpielerDetails = components['schemas']['SpielerDetails']
type SkillKategorie = components['schemas']['SkillKategorieInfo']

/**
 * Nachbildung des Admin-Servers für die Unit-Tests (C7, 3.4).
 *
 * **Zustand statt Konstante:** Lese- **und** Schreibhandler arbeiten auf einem `AdminWelt`-Objekt;
 * jede Antwort entsteht aus dem Zustand (Falle aus C3: ein Mock, der unabhängig von der Anfrage
 * antwortet, zeigt keine Änderung). Tests hängen die Handler mit `mockServer.use(...adminHandler(welt))`
 * vor.
 *
 * **Beispieldaten ohne reale Namen.** Die Schlüssel der Kategorien sind Beispiele; Code und Tests dürfen
 * sie nicht voraussetzen (Tests prüfen mit eigenen Kategorien, dass nichts fest verdrahtet ist).
 */

/** Was der nachgebildete Server von den Aufrufen gesehen hat. */
export type AdminProtokoll = {
  /** `X-FuBo-Kein-Refresh` je Abruf von `/admin/user/lesen` (Wert des Kopfes oder `null`). */
  profilAbrufe: (string | null)[]
  /** Dasselbe je Abruf von `/admin/skills/lesen`. */
  skillAbrufe: (string | null)[]
  /** Eingegangene Körper von `/admin/user/anlegen`. */
  angelegt: unknown[]
  /** Eingegangene Körper von `/admin/user/bearbeiten`. */
  bearbeitet: unknown[]
  /** Eingegangene Körper von `/admin/user/blockieren`. */
  blockiert: unknown[]
  /** Eingegangene Körper von `/admin/user/entfernen`. */
  entfernt: unknown[]
  /** Eingegangene Körper von `/admin/termin/anlegen`. */
  terminAngelegt: unknown[]
  /** Eingegangene Körper von `/admin/serie/anlegen`. */
  serieAngelegt: unknown[]
  /** Eingegangene Körper von `/admin/termin/aendern`. */
  terminGeaendert: unknown[]
  /** Eingegangene Körper von `/admin/termin/absagen`. */
  terminAbgesagt: unknown[]
  /** Eingegangene Körper von `/admin/termin/entfernen`. */
  terminEntfernt: unknown[]
}

/** Die nachgebildete Welt des Admins. */
export type AdminWelt = {
  /** Profile in der Reihenfolge des Servers: Spieler vorn, das Adminprofil am Ende. */
  profile: SpielerDetails[]
  /** Aktive Skillkategorien, nach `reihenfolge` sortiert. */
  skillKategorien: SkillKategorie[]
  /** Ids von Profilen, an denen fachliche Daten hängen (`409 PROFIL_IN_VERWENDUNG` beim Entfernen). */
  inVerwendung: Set<number>
  /** Nächste zu vergebende Profil-Id. */
  naechsteId: number
  /**
   * Die Termine, aufsteigend nach Beginn. **Dieselbe Liste** geben Tests an `terminHandlers(welt.termine)`
   * (Lesen); die Schreibhandler hier ändern sie **an Ort und Stelle**, damit beide denselben Stand sehen.
   */
  termine: TerminModell[]
  /** Ids von Terminen, an denen Daten hängen (`409 TERMIN_IN_VERWENDUNG` beim Entfernen); Zusagen, Teams und Ergebnis zählen immer. */
  terminInVerwendung: Set<number>
  /** Nächste zu vergebende Termin-Id. */
  naechsteTerminId: number
  /** Nächste zu vergebende Serien-Id. */
  naechsteSerieId: number
  protokoll: AdminProtokoll
  /**
   * Ändert ein Profil **hinter dem Rücken der Oberfläche** (etwa zwei geöffnete Browser).
   *
   * @param spielerId Id des Profils.
   * @param aenderung Felder, die sich ändern.
   */
  fremdeProfilAenderung: (spielerId: number, aenderung: Partial<Pick<SpielerDetails, 'name' | 'aktiv' | 'belegt' | 'skills'>>) => void
  /**
   * Ändert einen Termin **hinter dem Rücken der Oberfläche** (etwa ein zweiter Admin) und erhöht seine
   * `version`; die E5-Tests lösen damit `409 DATEN_VERALTET` aus.
   *
   * @param terminId Id des Termins.
   * @param aenderung Felder, die sich ändern.
   */
  fremdeAenderung: (terminId: number, aenderung: Partial<Pick<TerminModell, 'datum' | 'uhrzeit' | 'ort' | 'status'>>) => void
}

/** Kategorien wie am Server: vier Feldkategorien (0 bis 6) und Torwart (0 bis 3). */
export const beispielKategorien: SkillKategorie[] = [
  { schluessel: 'ANGRIFF', bezeichnung: 'Angriff', gewicht: 1, reihenfolge: 1, minWert: 0, maxWert: 6 },
  { schluessel: 'VERTEIDIGUNG', bezeichnung: 'Verteidigung', gewicht: 1, reihenfolge: 2, minWert: 0, maxWert: 6 },
  { schluessel: 'SPIELSTAERKE', bezeichnung: 'Spielstärke', gewicht: 1, reihenfolge: 3, minWert: 0, maxWert: 6 },
  { schluessel: 'LAUFSTAERKE', bezeichnung: 'Laufstärke', gewicht: 1, reihenfolge: 4, minWert: 0, maxWert: 6 },
  { schluessel: 'TORWART', bezeichnung: 'Torwart', gewicht: 0.3, reihenfolge: 5, minWert: 0, maxWert: 3 },
]

/** Baut ein Profil; Vorgabe: Spieler, aktiv, nicht online, vollständige Karte, Bilanz 0/0/0. */
export function profilModell(teil: Partial<SpielerDetails> & { spielerId: number; name: string }): SpielerDetails {
  return {
    rolle: 'USER',
    aktiv: true,
    belegt: false,
    skills: { ANGRIFF: 3, VERTEIDIGUNG: 3, SPIELSTAERKE: 3, LAUFSTAERKE: 3, TORWART: 2 },
    bilanz: { siege: 0, niederlagen: 0, unentschieden: 0 },
    ...teil,
  }
}

/**
 * Die Beispielwelt: `Beispielspieler 01` bis `05` (einer gesperrt, einer mit unvollständiger
 * Skillkarte, einer online), das Adminprofil `Beispieladmin` am Ende.
 *
 * @param teil Abweichungen von der Vorgabe.
 */
export function adminWelt(
  teil: Partial<Pick<AdminWelt, 'profile' | 'skillKategorien' | 'inVerwendung' | 'termine' | 'terminInVerwendung'>> = {},
): AdminWelt {
  const profile = teil.profile ?? [
    profilModell({ spielerId: 1, name: 'Beispielspieler 01', bilanz: { siege: 3, niederlagen: 2, unentschieden: 1 } }),
    profilModell({ spielerId: 2, name: 'Beispielspieler 02', aktiv: false }),
    profilModell({ spielerId: 3, name: 'Beispielspieler 03', belegt: true }),
    // Aus einem Datenimport: ohne Torwart und Laufstärke (E7).
    profilModell({ spielerId: 4, name: 'Beispielspieler 04', skills: { ANGRIFF: 4, VERTEIDIGUNG: 2, SPIELSTAERKE: 3 } }),
    profilModell({ spielerId: 5, name: 'Beispielspieler 05' }),
    profilModell({
      spielerId: 99,
      name: 'Beispieladmin',
      rolle: 'ADMIN',
      skills: { ANGRIFF: 0, VERTEIDIGUNG: 0, SPIELSTAERKE: 0, LAUFSTAERKE: 0, TORWART: 0 },
    }),
  ]
  const termine = teil.termine ?? []
  const welt: AdminWelt = {
    profile,
    skillKategorien: teil.skillKategorien ?? beispielKategorien,
    inVerwendung: teil.inVerwendung ?? new Set<number>(),
    naechsteId: Math.max(0, ...profile.map((p) => p.spielerId)) + 1,
    termine,
    terminInVerwendung: teil.terminInVerwendung ?? new Set<number>(),
    naechsteTerminId: Math.max(100, ...termine.map((t) => t.terminId)) + 1,
    naechsteSerieId: 1,
    protokoll: {
      profilAbrufe: [],
      skillAbrufe: [],
      angelegt: [],
      bearbeitet: [],
      blockiert: [],
      entfernt: [],
      terminAngelegt: [],
      serieAngelegt: [],
      terminGeaendert: [],
      terminAbgesagt: [],
      terminEntfernt: [],
    },
    fremdeProfilAenderung(spielerId, aenderung) {
      const profil = welt.profile.find((p) => p.spielerId === spielerId)
      if (profil) Object.assign(profil, aenderung)
    },
    fremdeAenderung(terminId, aenderung) {
      const modell = welt.termine.find((t) => t.terminId === terminId)
      if (!modell) return
      Object.assign(modell, aenderung)
      modell.version += 1
      zeitlichEinsortieren(welt.termine)
    },
  }
  return welt
}

/** `HH:MM` wird zu `HH:MM:SS`, wie der Server es zurückgibt. */
function uhrNormal(uhrzeit: string): string {
  return uhrzeit.length === 5 ? `${uhrzeit}:00` : uhrzeit
}

/** Sortiert die Termine an Ort und Stelle aufsteigend nach Beginn (wie der Server). */
function zeitlichEinsortieren(termine: TerminModell[]) {
  termine.sort((a, b) => (a.datum + a.uhrzeit).localeCompare(b.datum + b.uhrzeit))
}

/** Liegt an diesem Zeitpunkt schon ein Termin (auch ein abgesagter) ausser `ausser`? */
function terminBelegt(welt: AdminWelt, datum: string, uhrzeit: string, ausser?: number): boolean {
  return welt.termine.some((t) => t.terminId !== ausser && t.datum === datum && uhrNormal(t.uhrzeit) === uhrNormal(uhrzeit))
}

/** Beginnt der Termin nicht mehr in der Zukunft? */
function vergangen(datum: string, uhrzeit: string): boolean {
  return beginnVon({ datum, uhrzeit }).getTime() <= Date.now()
}

/** Wochentag nach ISO-8601 (1 = Montag bis 7 = Sonntag) eines Datums `YYYY-MM-DD`. */
function wochentagIso(datum: string): number {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  const tagNummer = new Date(jahr, monat - 1, tag, 12).getDay()
  return tagNummer === 0 ? 7 : tagNummer
}

/** Alle Tage von `start` bis `ende` (einschliesslich) als `YYYY-MM-DD`. */
function tageVonBis(start: string, ende: string): string[] {
  const [jahr, monat, tag] = start.split('-').map(Number)
  const tage: string[] = []
  for (let i = 0; i < 4000; i += 1) {
    const d = new Date(jahr, monat - 1, tag + i, 12)
    const iso = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (iso > ende) break
    tage.push(iso)
  }
  return tage
}

/** Prüft eine Skillkarte wie der Server: zuerst unbekannte Schlüssel und Bereiche, dann (beim Anlegen) die Vollständigkeit. */
function skillFehler(welt: AdminWelt, skills: Record<string, number>, vollstaendig: boolean): Response | null {
  for (const [schluessel, wert] of Object.entries(skills)) {
    const kategorie = welt.skillKategorien.find((k) => k.schluessel === schluessel.toUpperCase())
    if (!kategorie) return problem(400, 'EINGABE_UNGUELTIG', `Unbekannte Skillkategorie: ${schluessel}.`)
    if (!Number.isInteger(wert) || wert < kategorie.minWert || wert > kategorie.maxWert) {
      return problem(
        400,
        'EINGABE_UNGUELTIG',
        `Der Wert für ${kategorie.bezeichnung} muss zwischen ${String(kategorie.minWert)} und ${String(kategorie.maxWert)} liegen.`,
      )
    }
  }
  if (vollstaendig) {
    const fehlend = welt.skillKategorien.filter((k) => skills[k.schluessel] === undefined).map((k) => k.schluessel)
    if (fehlend.length > 0) return problem(400, 'EINGABE_UNGUELTIG', `Unvollständige Eingabe. Es fehlen: ${fehlend.join(', ')}.`)
  }
  return null
}

/** Ist der Name (ohne Rücksicht auf Gross- und Kleinschreibung) schon an ein **anderes** Profil vergeben? */
function nameBelegt(welt: AdminWelt, name: string, ausser?: number): boolean {
  return welt.profile.some((p) => p.spielerId !== ausser && p.name.toLowerCase() === name.toLowerCase())
}

/**
 * Handler der Profile (Stufe 2) und der Termin-Schreibaufrufe (Stufe 3): elf Operationen.
 * Die Termine werden über `terminHandlers(welt.termine)` gelesen.
 *
 * Nachgebildet wird, was die Tests brauchen: `NAME_BELEGT` ohne Beachtung der Gross- und Kleinschreibung
 * (der eigene Datensatz zählt nicht), vollständige Skillwerte beim Anlegen, Teilmenge beim Bearbeiten,
 * `PROFIL_GESCHUETZT` für das Adminprofil, `PROFIL_IN_VERWENDUNG`, Sperren beendet die Sitzung (`belegt: false`).
 *
 * @param welt Die Welt, auf der die Handler arbeiten.
 */
export function adminHandler(welt: AdminWelt) {
  const finden = (spielerId: unknown) => welt.profile.find((p) => p.spielerId === spielerId)
  const nichtGefunden = () => problem(404, 'INHALT_NICHT_GEFUNDEN', 'Das Profil wurde nicht gefunden.')
  const geschuetzt = () => problem(409, 'PROFIL_GESCHUETZT', 'Das Adminprofil kann so nicht geändert werden.')

  return [
    http.get('*/admin/user/lesen', ({ request }) => {
      welt.protokoll.profilAbrufe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      return HttpResponse.json(welt.profile)
    }),

    http.get('*/admin/skills/lesen', ({ request }) => {
      welt.protokoll.skillAbrufe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      return HttpResponse.json(welt.skillKategorien)
    }),

    http.post('*/admin/user/anlegen', async ({ request }) => {
      const rumpf = (await request.json()) as { name?: string; skills?: Record<string, number> }
      welt.protokoll.angelegt.push(rumpf)
      const name = (rumpf.name ?? '').trim()
      if (name === '') return problem(400, 'EINGABE_UNGUELTIG', 'Der Name darf nicht leer sein.')
      const fehler = skillFehler(welt, rumpf.skills ?? {}, true)
      if (fehler) return fehler
      if (nameBelegt(welt, name)) return problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.')
      const profil = profilModell({ spielerId: welt.naechsteId, name, skills: { ...rumpf.skills } })
      welt.naechsteId += 1
      // Spieler stehen vorn, das Adminprofil am Ende.
      const admin = welt.profile.findIndex((p) => p.rolle === 'ADMIN')
      welt.profile.splice(admin === -1 ? welt.profile.length : admin, 0, profil)
      return HttpResponse.json({ spielerId: profil.spielerId, name: profil.name }, { status: 201 })
    }),

    http.post('*/admin/user/bearbeiten', async ({ request }) => {
      const rumpf = (await request.json()) as { spielerId?: number; name?: string; skills?: Record<string, number> }
      welt.protokoll.bearbeitet.push(rumpf)
      const profil = finden(rumpf.spielerId)
      if (!profil) return nichtGefunden()
      if (profil.rolle === 'ADMIN') return geschuetzt()
      if (rumpf.name === undefined && rumpf.skills === undefined) {
        return problem(400, 'EINGABE_UNGUELTIG', 'Es wurde nichts zum Ändern angegeben.')
      }
      const name = rumpf.name?.trim()
      if (name === '') return problem(400, 'EINGABE_UNGUELTIG', 'Der Name darf nicht leer sein.')
      if (rumpf.skills) {
        const fehler = skillFehler(welt, rumpf.skills, false)
        if (fehler) return fehler
      }
      if (name !== undefined && nameBelegt(welt, name, profil.spielerId)) {
        return problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.')
      }
      if (name !== undefined) profil.name = name
      if (rumpf.skills) profil.skills = { ...profil.skills, ...rumpf.skills }
      return new HttpResponse(null, { status: 204 })
    }),

    http.post('*/admin/user/blockieren', async ({ request }) => {
      const rumpf = (await request.json()) as { spielerId?: number; blockieren?: boolean }
      welt.protokoll.blockiert.push(rumpf)
      const profil = finden(rumpf.spielerId)
      if (!profil) return nichtGefunden()
      if (profil.rolle === 'ADMIN') return geschuetzt()
      profil.aktiv = rumpf.blockieren === false
      // Wie am Server: Mit der Sperre endet die Sitzung des Spielers.
      if (rumpf.blockieren) profil.belegt = false
      return new HttpResponse(null, { status: 204 })
    }),

    http.post('*/admin/user/entfernen', async ({ request }) => {
      const rumpf = (await request.json()) as { spielerId?: number }
      welt.protokoll.entfernt.push(rumpf)
      const profil = finden(rumpf.spielerId)
      if (!profil) return nichtGefunden()
      if (profil.rolle === 'ADMIN') return geschuetzt()
      if (welt.inVerwendung.has(profil.spielerId)) {
        return problem(409, 'PROFIL_IN_VERWENDUNG', 'Das Profil hat bereits Daten und lässt sich nicht entfernen.')
      }
      welt.profile = welt.profile.filter((p) => p.spielerId !== profil.spielerId)
      return new HttpResponse(null, { status: 204 })
    }),
    // --- Termine (C7, Stufe 3) ---------------------------------------------------------------
    // Gelesen wird über `terminHandlers(welt.termine)`; hier stehen die fünf Schreibaufrufe. Die
    // Prüfreihenfolge folgt dem Server: Termin, Status, Version, Eingabe, Zeitpunkt.
    http.post('*/admin/termin/anlegen', async ({ request }) => {
      const rumpf = (await request.json()) as { datum?: string; uhrzeit?: string; ort?: string | null }
      welt.protokoll.terminAngelegt.push(rumpf)
      if (!rumpf.datum || !rumpf.uhrzeit) return problem(400, 'EINGABE_UNGUELTIG', 'Datum und Uhrzeit sind Pflicht.')
      if (vergangen(rumpf.datum, rumpf.uhrzeit)) {
        return problem(400, 'EINGABE_UNGUELTIG', 'Der Termin darf nicht in der Vergangenheit liegen.')
      }
      if (terminBelegt(welt, rumpf.datum, rumpf.uhrzeit)) {
        return problem(409, 'TERMIN_BELEGT', 'Zu diesem Zeitpunkt gibt es bereits einen Termin.')
      }
      const ort = rumpf.ort?.trim()
      const modell = terminModell({
        terminId: welt.naechsteTerminId,
        datum: rumpf.datum,
        uhrzeit: uhrNormal(rumpf.uhrzeit),
        ort: ort ? ort : null,
        zusagen: [],
      })
      welt.naechsteTerminId += 1
      welt.termine.push(modell)
      zeitlichEinsortieren(welt.termine)
      return HttpResponse.json({ terminId: modell.terminId, datum: modell.datum, uhrzeit: modell.uhrzeit }, { status: 201 })
    }),

    http.post('*/admin/serie/anlegen', async ({ request }) => {
      const rumpf = (await request.json()) as {
        titel?: string
        wochentag?: number
        uhrzeit?: string
        startdatum?: string
        enddatum?: string
        ort?: string | null
      }
      welt.protokoll.serieAngelegt.push(rumpf)
      const { titel, wochentag, uhrzeit, startdatum, enddatum } = rumpf
      if (!titel?.trim() || !wochentag || !uhrzeit || !startdatum || !enddatum) {
        return problem(400, 'EINGABE_UNGUELTIG', 'Titel, Wochentag, Uhrzeit und Zeitraum sind Pflicht.')
      }
      if (enddatum <= startdatum) return problem(400, 'EINGABE_UNGUELTIG', 'Das Enddatum muss nach dem Startdatum liegen.')
      const tage = tageVonBis(startdatum, enddatum).filter((tag) => wochentagIso(tag) === wochentag)
      if (tage.length === 0) return problem(400, 'EINGABE_UNGUELTIG', 'Im Zeitraum liegt kein passender Wochentag.')
      if (vergangen(tage[0], uhrzeit)) return problem(400, 'EINGABE_UNGUELTIG', 'Der erste Termin liegt in der Vergangenheit.')
      if (tage.length > 52) {
        return problem(400, 'EINGABE_UNGUELTIG', `Die Serie umfasst ${String(tage.length)} Termine, höchstens 52 sind erlaubt.`)
      }
      const serieId = welt.naechsteSerieId
      welt.naechsteSerieId += 1
      const ort = rumpf.ort?.trim()
      const angelegt: { terminId: number; datum: string; uhrzeit: string }[] = []
      const uebersprungen: string[] = []
      for (const tag of tage) {
        if (terminBelegt(welt, tag, uhrzeit)) {
          uebersprungen.push(tag)
          continue
        }
        const modell = terminModell({
          terminId: welt.naechsteTerminId,
          datum: tag,
          uhrzeit: uhrNormal(uhrzeit),
          ort: ort ? ort : null,
          zusagen: [],
          serieId,
        })
        welt.naechsteTerminId += 1
        welt.termine.push(modell)
        angelegt.push({ terminId: modell.terminId, datum: modell.datum, uhrzeit: modell.uhrzeit })
      }
      zeitlichEinsortieren(welt.termine)
      return HttpResponse.json(
        { serieId, titel: titel.trim(), angelegteTermine: angelegt, uebersprungeneTermine: uebersprungen },
        { status: 201 },
      )
    }),

    http.post('*/admin/termin/aendern', async ({ request }) => {
      const rumpf = (await request.json()) as {
        terminId?: number
        version?: number
        datum?: string | null
        uhrzeit?: string | null
        ort?: string | null
        status?: TerminModell['status'] | null
      }
      welt.protokoll.terminGeaendert.push(rumpf)
      const modell = welt.termine.find((t) => t.terminId === rumpf.terminId)
      if (!modell) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (modell.status !== 'GEPLANT') return problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist nicht mehr geplant.')
      if (rumpf.version !== modell.version) {
        return problem(409, 'DATEN_VERALTET', 'Der Datensatz wurde zwischenzeitlich geändert.')
      }
      if (rumpf.status === 'GEPLANT') return problem(400, 'EINGABE_UNGUELTIG', 'Zurück nach GEPLANT ist nicht möglich.')
      const aendertZeit = rumpf.datum != null || rumpf.uhrzeit != null
      if (!aendertZeit && rumpf.ort == null && rumpf.status == null) {
        return problem(400, 'EINGABE_UNGUELTIG', 'Es wurde nichts zum Ändern angegeben.')
      }
      const datum = rumpf.datum ?? modell.datum
      const uhrzeit = rumpf.uhrzeit != null ? uhrNormal(rumpf.uhrzeit) : modell.uhrzeit
      if (aendertZeit) {
        if (vergangen(datum, uhrzeit)) return problem(400, 'EINGABE_UNGUELTIG', 'Der Termin darf nicht in der Vergangenheit liegen.')
        if (terminBelegt(welt, datum, uhrzeit, modell.terminId)) {
          return problem(409, 'TERMIN_BELEGT', 'Zu diesem Zeitpunkt gibt es bereits einen Termin.')
        }
      }
      modell.datum = datum
      modell.uhrzeit = uhrzeit
      if (rumpf.ort != null) modell.ort = rumpf.ort.trim() === '' ? null : rumpf.ort.trim()
      if (rumpf.status != null) modell.status = rumpf.status
      modell.version += 1
      zeitlichEinsortieren(welt.termine)
      return new HttpResponse(null, { status: 204 })
    }),

    http.post('*/admin/termin/absagen', async ({ request }) => {
      const rumpf = (await request.json()) as { terminId?: number }
      welt.protokoll.terminAbgesagt.push(rumpf)
      const modell = welt.termine.find((t) => t.terminId === rumpf.terminId)
      if (!modell) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (modell.status !== 'GEPLANT') {
        return problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist bereits abgesagt oder abgeschlossen.')
      }
      modell.status = 'ABGESAGT'
      modell.version += 1
      return new HttpResponse(null, { status: 204 })
    }),

    http.post('*/admin/termin/entfernen', async ({ request }) => {
      const rumpf = (await request.json()) as { terminId?: number }
      welt.protokoll.terminEntfernt.push(rumpf)
      const index = welt.termine.findIndex((t) => t.terminId === rumpf.terminId)
      if (index === -1) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      const modell = welt.termine[index]
      if (modell.zusagen.length > 0 || modell.teams || modell.ergebnis || welt.terminInVerwendung.has(modell.terminId)) {
        return problem(409, 'TERMIN_IN_VERWENDUNG', 'Am Termin hängen Rückmeldungen oder Teams.')
      }
      welt.termine.splice(index, 1)
      return new HttpResponse(null, { status: 204 })
    }),
  ]
}
