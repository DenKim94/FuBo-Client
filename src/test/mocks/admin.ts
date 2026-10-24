import { HttpResponse, http } from 'msw'
import type { components } from '@/api/common/types/schema'
import { beginnVon } from '@/api/termine/terminZeit'
import { problem } from './problem'
import { terminModell, type TerminModell } from './termine'

type SpielerDetails = components['schemas']['SpielerDetails']
type SkillKategorie = components['schemas']['SkillKategorieInfo']
type Konfiguration = components['schemas']['Konfiguration']
type GastPlatzInfo = components['schemas']['GastPlatzInfo']
type GastStufe = components['schemas']['GastStufe']

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
  /** `X-FuBo-Kein-Refresh` je Abruf von `/admin/config/lesen` (Wert des Kopfes oder `null`). */
  konfigurationAbrufe: (string | null)[]
  /** Eingegangene Körper von `/admin/config/aendern`. */
  konfigurationGeaendert: unknown[]
  /** `X-FuBo-Kein-Refresh` je Abruf von `/admin/gast/lesen`. */
  gaesteAbrufe: (string | null)[]
  /** Eingegangene Körper von `/admin/gast/freigeben`. */
  gaesteFreigegeben: unknown[]
  /** Eingegangene Körper von `/admin/teilnahme/gast-stufe`. */
  gastStufen: unknown[]
  /** Eingegangene Körper von `/admin/teilnahme/gast-absagen` (Vertragsvorschlag vom 24.10.2026). */
  gastAbgesagt: unknown[]
  /** Eingegangene Körper von `/admin/halle/absagen`. */
  halleAbgesagt: unknown[]
  /** Eingegangene Körper von `/admin/ergebnis/korrigieren`. */
  ergebnisKorrigiert: unknown[]
  /** Eingegangene Körper von `/admin/teams/generieren`. */
  teamsManuell: unknown[]
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
  /**
   * Die Konfiguration (C8). `version` steigt bei jedem Schreiben; `halleAbsageVorlageEffektiv` entsteht beim Lesen
   * aus `halleAbsageVorlage` (der Server nimmt bei `null` seine Ersatzvorlage).
   */
  konfiguration: Omit<Konfiguration, 'halleAbsageVorlageEffektiv'>
  /** Die Gastplätze nach Nummer (C8): belegt mit lebender Sitzung, verwaist, frei, unwirksam. */
  gastplaetze: GastPlatzInfo[]
  /**
   * `true`: Der Versand der Hallenabsage scheitert (`503 VERSAND_FEHLGESCHLAGEN`); der Aufruf hinterlässt nichts und
   * lässt sich wiederholen. Ein Test stellt es nach dem ersten Versuch wieder auf `false`.
   */
  mailFehler: boolean
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
  /**
   * Ändert die Konfiguration **hinter dem Rücken der Oberfläche** (ein zweiter Browser) und erhöht ihre `version`;
   * die E5-Tests lösen damit `409 DATEN_VERALTET` aus.
   *
   * @param aenderung Felder, die sich ändern.
   */
  fremdeKonfigurationAenderung: (aenderung?: Partial<Omit<Konfiguration, 'halleAbsageVorlageEffektiv' | 'version'>>) => void
  /**
   * Korrigiert das Ergebnis eines Termins **hinter dem Rücken der Oberfläche** (ein zweiter Admin) und erhöht seine
   * `version`; die E5-Tests lösen damit `409 DATEN_VERALTET` aus.
   *
   * @param terminId Id des Termins; er muss ein Ergebnis tragen.
   * @param aenderung Felder, die sich ändern (Vorgabe: nur die `version` steigt).
   */
  fremdeErgebnisAenderung: (terminId: number, aenderung?: Partial<Pick<NonNullable<TerminModell['ergebnis']>, 'sieger' | 'deutlich'>>) => void
}

/** Die Ersatzvorlage des Servers für die Hallenabsage (Beispieltext). */
export const STANDARD_ABSAGEVORLAGE = 'Guten Tag, wir müssen den Termin leider absagen.'

/** Die Vorgaben des Servers (Vertrag), mit ausgeschaltetem Hallenmodus und ohne Adresse. */
export function beispielKonfiguration(teil: Partial<AdminWelt['konfiguration']> = {}): AdminWelt['konfiguration'] {
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

/** Ein Gastplatz; Vorgabe: frei und wirksam. */
export function gastPlatz(teil: Partial<GastPlatzInfo> & { nummer: number }): GastPlatzInfo {
  return { anzeigeName: `Gast ${String(teil.nummer)}`, wirksam: true, belegt: false, ...teil }
}

/**
 * Vier Plätze: 1 belegt mit lebender Sitzung, 2 belegt ohne Sitzung (verwaist), 3 und 4 frei.
 * Der Gast auf Platz 1 heißt `Beispielgast` wie in der Teilnehmerliste der Beispieltermine.
 */
export function beispielGastplaetze(): GastPlatzInfo[] {
  return [
    gastPlatz({
      nummer: 1,
      belegt: true,
      belegtSeit: '2099-01-13T18:00:00Z',
      gastName: 'Beispielgast',
      gastStufe: 'STARK',
      sitzungGueltig: true,
    }),
    gastPlatz({
      nummer: 2,
      belegt: true,
      belegtSeit: '2099-01-12T18:00:00Z',
      gastName: 'Beispielgast Zwei',
      gastStufe: 'SCHWACH',
      sitzungGueltig: false,
    }),
    gastPlatz({ nummer: 3 }),
    gastPlatz({ nummer: 4 }),
  ]
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
  teil: Partial<
    Pick<AdminWelt, 'profile' | 'skillKategorien' | 'inVerwendung' | 'termine' | 'terminInVerwendung' | 'konfiguration' | 'gastplaetze'>
  > = {},
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
    konfiguration: teil.konfiguration ?? beispielKonfiguration(),
    gastplaetze: teil.gastplaetze ?? beispielGastplaetze(),
    mailFehler: false,
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
      konfigurationAbrufe: [],
      konfigurationGeaendert: [],
      gaesteAbrufe: [],
      gaesteFreigegeben: [],
      gastStufen: [],
      gastAbgesagt: [],
      halleAbgesagt: [],
      ergebnisKorrigiert: [],
      teamsManuell: [],
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
    fremdeKonfigurationAenderung(aenderung = { minTeilnehmer: welt.konfiguration.minTeilnehmer }) {
      Object.assign(welt.konfiguration, aenderung)
      welt.konfiguration.version += 1
    },
    fremdeErgebnisAenderung(terminId, aenderung = {}) {
      const ergebnis = welt.termine.find((t) => t.terminId === terminId)?.ergebnis
      if (!ergebnis) return
      Object.assign(ergebnis, aenderung)
      ergebnis.korrigiertAm = new Date().toISOString()
      ergebnis.version += 1
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

/** Alle Pflichtfelder des Voll-Updates der Konfiguration (die vierzehn änderbaren und die `version`). */
const KONFIGURATION_PFLICHTFELDER = [
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

    // --- Konfiguration, Gastplätze, Gast-Stufe (C8, Stufe 4) -----------------------------------
    http.get('*/admin/config/lesen', ({ request }) => {
      welt.protokoll.konfigurationAbrufe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      return HttpResponse.json({
        ...welt.konfiguration,
        halleAbsageVorlageEffektiv: welt.konfiguration.halleAbsageVorlage ?? STANDARD_ABSAGEVORLAGE,
      })
    }),

    // Voll-Update wie am Server: fehlendes Pflichtfeld ⇒ 400 mit Schlüssel in `felder`; `version` weicht ab ⇒ 409;
    // `halleAbsageVorlageEffektiv` im Körper wird ignoriert.
    http.post('*/admin/config/aendern', async ({ request }) => {
      const rumpf = (await request.json()) as Record<string, unknown>
      welt.protokoll.konfigurationGeaendert.push(rumpf)
      const fehlend = KONFIGURATION_PFLICHTFELDER.filter((feld) => rumpf[feld] === undefined)
      if (fehlend.length > 0) {
        return problem(
          400,
          'EINGABE_UNGUELTIG',
          'Die Eingabe ist ungültig.',
          Object.fromEntries(fehlend.map((feld) => [feld, 'Pflichtfeld.'])),
        )
      }
      if (rumpf.version !== welt.konfiguration.version) {
        return problem(409, 'DATEN_VERALTET', 'Die Konfiguration wurde zwischenzeitlich geändert.')
      }
      const neu = rumpf as unknown as Omit<Konfiguration, 'halleAbsageVorlageEffektiv' | 'geaendertAm'>
      if (neu.maxTeilnehmer < neu.minTeilnehmer) {
        return problem(400, 'EINGABE_UNGUELTIG', 'Die Eingabe ist ungültig.', {
          maxTeilnehmer: `Die Höchstzahl (${String(neu.maxTeilnehmer)}) darf nicht unter der Mindestzahl (${String(neu.minTeilnehmer)}) liegen.`,
        })
      }
      for (const feld of KONFIGURATION_PFLICHTFELDER) {
        if (feld !== 'version') (welt.konfiguration as Record<string, unknown>)[feld] = rumpf[feld]
      }
      welt.konfiguration.geaendertAm = new Date().toISOString()
      welt.konfiguration.version += 1
      return new HttpResponse(null, { status: 204 })
    }),

    http.get('*/admin/gast/lesen', ({ request }) => {
      welt.protokoll.gaesteAbrufe.push(request.headers.get('X-FuBo-Kein-Refresh'))
      return HttpResponse.json(welt.gastplaetze)
    }),

    // Genau eines der beiden Felder; unbekannte Nummer ⇒ 400; ein freier Platz wird übersprungen. Wie am Server
    // endet mit dem Platz die Sitzung des Gastes (hier nur als Zustand: der Platz ist frei).
    http.post('*/admin/gast/freigeben', async ({ request }) => {
      const rumpf = (await request.json()) as { slotIds?: number[] | null; alle?: boolean | null }
      welt.protokoll.gaesteFreigegeben.push(rumpf)
      const hatIds = rumpf.slotIds !== undefined && rumpf.slotIds !== null
      const hatAlle = rumpf.alle === true
      if (hatIds === hatAlle) return problem(400, 'EINGABE_UNGUELTIG', 'Genau eines von slotIds und alle ist anzugeben.')
      const nummern = hatAlle ? welt.gastplaetze.filter((p) => p.belegt).map((p) => p.nummer) : (rumpf.slotIds ?? [])
      if (nummern.length === 0) return problem(400, 'EINGABE_UNGUELTIG', 'slotIds darf nicht leer sein.')
      const unbekannt = nummern.filter((n) => !welt.gastplaetze.some((p) => p.nummer === n))
      if (unbekannt.length > 0) return problem(400, 'EINGABE_UNGUELTIG', `Unbekannte Platznummer: ${unbekannt.join(', ')}.`)
      welt.gastplaetze = welt.gastplaetze.map((platz) =>
        nummern.includes(platz.nummer)
          ? gastPlatz({ nummer: platz.nummer, anzeigeName: platz.anzeigeName, wirksam: platz.wirksam })
          : platz,
      )
      return new HttpResponse(null, { status: 204 })
    }),

    // Die einzige Adminaktion an einer Teilnahme: Stufe; der Name wird zeichengenau verglichen.
    // Vertragsvorschlag vom 24.10.2026 (server/harness/tmp/SERVER_ANFRAGE_GAST_ABSAGEN.md): wirkt wie die Absage des Gastes.
    http.post('*/admin/teilnahme/gast-absagen', async ({ request }) => {
      const rumpf = (await request.json()) as { terminId?: number; gastName?: string }
      welt.protokoll.gastAbgesagt.push(rumpf)
      const modell = welt.termine.find((t) => t.terminId === rumpf.terminId)
      const zusage = modell?.zusagen.find((z) => z.gast && z.name === rumpf.gastName)
      if (!modell || !zusage) {
        return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Für diesen Termin liegt keine Zusage dieses Gastes vor.')
      }
      if (modell.status !== 'GEPLANT' || vergangen(modell.datum, modell.uhrzeit)) {
        return problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin nimmt keine Rückmeldungen mehr an.')
      }
      modell.zusagen = modell.zusagen.filter((z) => z !== zusage)
      // Eine Absage ändert den Kreis (Einteilung veraltet), öffnet aber kein Kontingent: Der Kontingentstand bleibt.
      modell.kontingentVersion ??= modell.teilnehmerVersion
      modell.teilnehmerVersion += 1
      return new HttpResponse(null, { status: 204 })
    }),

    http.post('*/admin/teilnahme/gast-stufe', async ({ request }) => {
      const rumpf = (await request.json()) as { terminId?: number; gastName?: string; stufe?: GastStufe }
      welt.protokoll.gastStufen.push(rumpf)
      const modell = welt.termine.find((t) => t.terminId === rumpf.terminId)
      const zusage = modell?.zusagen.find((z) => z.gast && z.name === rumpf.gastName)
      if (!modell || !zusage) {
        return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Für diesen Termin liegt keine Teilnahme dieses Gastes vor.')
      }
      zusage.stufe = rumpf.stufe
      // Ändert den Teilnehmerkreis: Eine vorhandene Einteilung gilt danach als veraltet, das Kontingent öffnet neu.
      modell.teilnehmerVersion += 1
      if (modell.kontingentVersion !== undefined) modell.kontingentVersion = modell.teilnehmerVersion
      return new HttpResponse(null, { status: 204 })
    }),

    // --- Hallenabsage (C8, Stufe 5) ------------------------------------------------------------
    // Reihenfolge der Prüfung wie am Server: Modus (auch für unbekannte Termine, nicht 404), Termin, Status, Frist,
    // Adresse, bereits abgesagt. Bei `mailFehler` bleibt nichts zurück (503).
    http.post('*/admin/halle/absagen', async ({ request }) => {
      const rumpf = (await request.json()) as { terminId?: number }
      welt.protokoll.halleAbgesagt.push(rumpf)
      if (!welt.konfiguration.hallenModusAktiv) return problem(409, 'HALLE_MODUS_INAKTIV', 'Der Hallenmodus ist abgeschaltet.')
      const modell = welt.termine.find((t) => t.terminId === rumpf.terminId)
      if (!modell) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (modell.status === 'ABGESCHLOSSEN') return problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist ABGESCHLOSSEN.')
      const bis = modell.halleAbsageMoeglichBis ?? `${modell.datum}T${modell.uhrzeit.slice(0, 5)}:00`
      if (Date.now() >= Date.parse(bis)) {
        return problem(
          409,
          'HALLE_FRIST_ABGELAUFEN',
          `Die Absage ist nur bis ${bis} möglich (Vorlauf ${String(welt.konfiguration.halleVorlaufStunden)} Stunden).`,
        )
      }
      if (!welt.konfiguration.halleEmail) {
        return problem(409, 'HALLE_NICHT_KONFIGURIERT', 'Es ist keine E-Mail-Adresse des Hallenbetreibers hinterlegt.')
      }
      if (modell.halleAbgesagtAm) {
        return problem(409, 'HALLE_BEREITS_ABGESAGT', `Die Absage ging bereits am ${modell.halleAbgesagtAm} hinaus.`)
      }
      if (welt.mailFehler) return problem(503, 'VERSAND_FEHLGESCHLAGEN', 'Die E-Mail konnte nicht gesendet werden.')
      modell.halleAbgesagtAm = new Date().toISOString()
      modell.status = 'ABGESAGT'
      modell.version += 1
      return new HttpResponse(null, { status: 204 })
    }),

    // --- Ergebniskorrektur (C8, Stufe 5; zog aus dem zustandslosen Stub nach hier) --------------
    // Voll-Update: `version` weicht ab ⇒ 409; `deutlich` bei `U` ⇒ 400; ohne Ergebnis ⇒ 404.
    http.post('*/admin/ergebnis/korrigieren', async ({ request }) => {
      const rumpf = (await request.json()) as { terminId: number; sieger: 'A' | 'B' | 'U'; deutlich: boolean; version: number }
      welt.protokoll.ergebnisKorrigiert.push(rumpf)
      const modell = welt.termine.find((t) => t.terminId === rumpf.terminId)
      if (!modell?.ergebnis) return problem(404, 'INHALT_NICHT_GEFUNDEN', 'Für diesen Termin liegt kein Ergebnis vor.')
      if (rumpf.sieger === 'U' && rumpf.deutlich) {
        return problem(400, 'EINGABE_UNGUELTIG', 'Ein Unentschieden kann nicht deutlich sein.', {
          deutlich: 'Bei einem Unentschieden nicht möglich.',
        })
      }
      if (rumpf.version !== modell.ergebnis.version) {
        return problem(409, 'DATEN_VERALTET', 'Das Ergebnis wurde zwischenzeitlich korrigiert.')
      }
      modell.ergebnis = {
        ...modell.ergebnis,
        sieger: rumpf.sieger,
        deutlich: rumpf.deutlich,
        korrigiertAm: new Date().toISOString(),
        version: modell.ergebnis.version + 1,
      }
      return new HttpResponse(null, { status: 204 })
    }),

    // --- Manuelle Teamgenerierung (C8, Stufe 5) --------------------------------------------------
    // Prüfung wie am Server: unbekannte/gesperrte Id ⇒ 400, Adminprofil ⇒ 409 PROFIL_GESCHUETZT, Zahl gegen die
    // Konfiguration, unvollständige Skillkarte ⇒ 409. Gerechnet wird nur zum Schein: erste Hälfte Team A, Rest Team B.
    // Mit mehr als 24 Teilnehmern weicht `EXHAUSTIV` auf `HEURISTIK` aus; `ZULETZT_ANGEMELDET` fällt auf den Schwächsten.
    http.post('*/admin/teams/generieren', async ({ request }) => {
      const rumpf = (await request.json()) as { spielerIds?: number[]; gaeste?: { name?: string | null; stufe: GastStufe }[] }
      welt.protokoll.teamsManuell.push(rumpf)
      const ids = rumpf.spielerIds ?? []
      const gaeste = rumpf.gaeste ?? []
      const gewaehlt: SpielerDetails[] = []
      for (const id of ids) {
        const profil = welt.profile.find((p) => p.spielerId === id)
        if (!profil || !profil.aktiv) return problem(400, 'EINGABE_UNGUELTIG', `Das Profil ${String(id)} ist unbekannt oder gesperrt.`)
        if (profil.rolle === 'ADMIN') return problem(409, 'PROFIL_GESCHUETZT', 'Das Adminprofil kann nicht eingeteilt werden.')
        gewaehlt.push(profil)
      }
      const anzahl = gewaehlt.length + gaeste.length
      if (anzahl === 0) return problem(400, 'EINGABE_UNGUELTIG', 'Es wurde niemand ausgewählt.')
      const { minTeilnehmer, maxTeilnehmer } = welt.konfiguration
      if (anzahl < minTeilnehmer) {
        return problem(409, 'ZU_WENIG_TEILNEHMER', `Es braucht mindestens ${String(minTeilnehmer)} Teilnehmer, ausgewählt sind ${String(anzahl)}.`)
      }
      if (anzahl > maxTeilnehmer) {
        return problem(409, 'ZU_VIELE_TEILNEHMER', `Es sind höchstens ${String(maxTeilnehmer)} Teilnehmer erlaubt, ausgewählt sind ${String(anzahl)}.`)
      }
      const unvollstaendig = gewaehlt.filter((p) => welt.skillKategorien.some((k) => p.skills[k.schluessel] === undefined))
      if (unvollstaendig.length > 0) {
        return problem(
          409,
          'SKILLWERTE_UNVOLLSTAENDIG',
          `Die Skillwerte von ${unvollstaendig.map((p) => p.name).join(', ')} sind unvollständig.`,
        )
      }
      const namen = [
        ...gewaehlt.map((p) => ({ anzeigeName: p.name, gast: false })),
        ...gaeste.map((g, i) => ({ anzeigeName: g.name?.trim() ? g.name.trim() : `Gast ${String(i + 1)}`, gast: true })),
      ]
      const haelfte = Math.ceil(namen.length / 2)
      const ungerade = namen.length % 2 === 1
      const teamA = namen.slice(0, haelfte).map((n) => ({ ...n, auswechselspieler: false }))
      const teamB = namen.slice(haelfte).map((n) => ({ ...n, auswechselspieler: false }))
      if (ungerade) teamA[teamA.length - 1].auswechselspieler = true
      return HttpResponse.json({
        algorithmType: anzahl > 24 ? 'HEURISTIK' : welt.konfiguration.algorithmType,
        auswechselModus: 'SCHWAECHSTER_UEBERZAHL',
        auswechselspieler: ungerade ? teamA[teamA.length - 1].anzeigeName : null,
        differenzTeamstaerke: 1.25,
        teamA,
        teamB,
      })
    }),
  ]
}
