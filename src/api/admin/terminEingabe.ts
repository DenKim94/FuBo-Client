import type { SerieAnlegen, TerminAendern, TerminAnlegen } from '@/api/admin/adminTermine'
import { beginnVon, uhrzeitKurz } from '@/api/termine/terminZeit'

/**
 * Reine Hilfen für die Eingaben der Terminverwaltung (C7, Stufe 3): was gesendet wird, wann
 * gesperrt wird und welche Grenzen gelten. Ohne React und ohne Uhr im Modul – die Zeit kommt
 * als Parameter, damit nichts im Render die Uhr liest.
 */

/** Längster Ort in Zeichen (Vertrag). */
export const ORT_MAX = 160

/** Ab dieser Länge zeigt das Ortsfeld einen Zähler. */
export const ORT_ZAEHLER_AB = 140

/** Längster Titel einer Serie in Zeichen. */
export const TITEL_MAX = 80

/** Mehr Termine legt der Server je Serie nicht an. */
export const SERIE_MAX_TERMINE = 52

/** Wochentage für die Auswahl: ISO-Zahl als Text (1 = Montag bis 7 = Sonntag), voller Name und Kurzform („Mo“). */
export const WOCHENTAGE: readonly { wert: string; text: string; kurz: string }[] = [
  { wert: '1', text: 'Montag', kurz: 'Mo' },
  { wert: '2', text: 'Dienstag', kurz: 'Di' },
  { wert: '3', text: 'Mittwoch', kurz: 'Mi' },
  { wert: '4', text: 'Donnerstag', kurz: 'Do' },
  { wert: '5', text: 'Freitag', kurz: 'Fr' },
  { wert: '6', text: 'Samstag', kurz: 'Sa' },
  { wert: '7', text: 'Sonntag', kurz: 'So' },
]

/** Die Felder des Termin-Formulars, als Text bis zum Senden. */
export type TerminWerte = { datum: string; uhrzeit: string; ort: string }

/** Die Felder des Serien-Formulars, als Text bis zum Senden. */
export type SerieWerte = {
  titel: string
  /** `'1'` bis `'7'` oder leer (keine Vorauswahl). */
  wochentag: string
  uhrzeit: string
  startdatum: string
  enddatum: string
  ort: string
}

/**
 * Alle Eingaben der Seite „Termin anlegen“: Einzeltermin und Serie teilen sich Datum (bei der Serie das
 * Startdatum), Uhrzeit und Ort; der Wechsel der Art behält sie.
 */
export type NeuWerte = TerminWerte & {
  /** Titel der Serie. */
  titel: string
  /** `'1'` bis `'7'` oder leer: Der Wochentag hat **keine Vorauswahl**. */
  wochentag: string
  /** Enddatum der Serie. */
  enddatum: string
}

/**
 * Die Eingaben der Seite als Serie: das gemeinsame Datum ist das Startdatum.
 *
 * @param werte Die Eingaben der Seite.
 */
export function alsSerie(werte: NeuWerte): SerieWerte {
  return { ...werte, startdatum: werte.datum }
}

/** Fehlertexte je Feld der Serie. */
export type SerieFehler = Partial<Record<'titel' | 'wochentag' | 'uhrzeit' | 'startdatum' | 'enddatum', string>>

/** Text, wenn das Enddatum nicht nach dem Startdatum liegt (der Server bleibt die Wahrheit). */
export const FEHLER_ENDDATUM = 'Das Enddatum muss nach dem Startdatum liegen.'

/**
 * Beginnt der Termin nicht mehr in der Zukunft?
 *
 * Datum **und** Uhrzeit zusammen: Ein Termin, der heute morgen war, nähme keine Rückmeldung mehr an.
 * Die Uhr kommt als Parameter (Aufruf im Submit-Handler mit `Date.now()`, nicht im Render).
 *
 * @param datum `YYYY-MM-DD`.
 * @param uhrzeit `HH:MM` oder `HH:MM:SS`.
 * @param jetztMs Der Zeitpunkt, gegen den geprüft wird (Millisekunden).
 */
export function liegtInVergangenheit(datum: string, uhrzeit: string, jetztMs: number): boolean {
  return beginnVon({ datum, uhrzeit }).getTime() <= jetztMs
}

/**
 * Körper für `POST /admin/termin/anlegen`: `ort` getrimmt und, wenn leer, **weggelassen**.
 *
 * @param werte Die Felder des Formulars.
 */
export function anlegenKoerper(werte: TerminWerte): TerminAnlegen {
  const ort = werte.ort.trim()
  return { datum: werte.datum, uhrzeit: werte.uhrzeit, ...(ort === '' ? {} : { ort }) }
}

/**
 * Körper für `POST /admin/termin/aendern`: nur, was sich gegenüber dem Stand geändert hat (E11).
 *
 * - `uhrzeit` wird ohne Sekunden verglichen (`19:00:00` und `19:00` sind dieselbe Zeit).
 * - `ort`: getrimmt verglichen; ein geleerter, vorher gesetzter Ort geht als `""` hinaus (leeren),
 *   nicht als `null` (unverändert).
 * - Ist nichts geändert, gibt es `null` zurück: Der Server lehnt einen Körper ohne Änderung mit `400` ab,
 *   das Speichern bleibt gesperrt.
 *
 * @param stand Der Termin, mit dem das Formular gebaut wurde (samt `version`).
 * @param jetzt Die Felder des Formulars.
 */
export function aenderungKoerper(
  stand: { terminId: number; version: number; datum: string; uhrzeit: string; ort?: string | null },
  jetzt: TerminWerte,
): TerminAendern | null {
  const koerper: TerminAendern = { terminId: stand.terminId, version: stand.version }
  let geaendert = false
  if (jetzt.datum !== stand.datum) {
    koerper.datum = jetzt.datum
    geaendert = true
  }
  if (uhrzeitKurz(jetzt.uhrzeit) !== uhrzeitKurz(stand.uhrzeit)) {
    koerper.uhrzeit = jetzt.uhrzeit
    geaendert = true
  }
  const ort = jetzt.ort.trim()
  if (ort !== (stand.ort ?? '').trim()) {
    koerper.ort = ort
    geaendert = true
  }
  return geaendert ? koerper : null
}

/**
 * Körper für `POST /admin/serie/anlegen`. Setzt Felder voraus, die {@link serieFehler} als gültig
 * erkannt hat (insbesondere einen gewählten Wochentag).
 *
 * @param werte Die Felder des Formulars.
 */
export function serieKoerper(werte: SerieWerte): SerieAnlegen {
  const ort = werte.ort.trim()
  return {
    titel: werte.titel.trim(),
    wochentag: Number(werte.wochentag),
    uhrzeit: werte.uhrzeit,
    startdatum: werte.startdatum,
    enddatum: werte.enddatum,
    ...(ort === '' ? {} : { ort }),
  }
}

/**
 * Prüft das Serien-Formular. Leer ist in diesem Zustand ein Fehler **ohne Text** am Feld (die
 * Schaltfläche nennt den Grund); nur das Enddatum bekommt einen Satz, weil der Fehler dort nicht
 * offensichtlich ist.
 *
 * @param werte Die Felder des Formulars.
 * @returns Fehler je Feld; leer, wenn alles gültig ist.
 */
export function serieFehler(werte: SerieWerte): SerieFehler {
  const fehler: SerieFehler = {}
  if (werte.titel.trim() === '') fehler.titel = ''
  if (!WOCHENTAGE.some((t) => t.wert === werte.wochentag)) fehler.wochentag = ''
  if (werte.uhrzeit === '') fehler.uhrzeit = ''
  if (werte.startdatum === '') fehler.startdatum = ''
  if (werte.enddatum === '') fehler.enddatum = ''
  else if (werte.startdatum !== '' && werte.enddatum <= werte.startdatum) fehler.enddatum = FEHLER_ENDDATUM
  return fehler
}
