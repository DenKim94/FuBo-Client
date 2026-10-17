import type { TerminUebersicht } from '@/api/termine/termine'

/** Wie viele Tage rückwärts der Verlauf reicht (E14). Die Oberfläche nennt die Zahl aus dieser Konstante. */
export const VERLAUF_TAGE = 60

/** Teile eines Datums `YYYY-MM-DD` als Zahlen. */
function datumsteile(datum: string): [jahr: number, monat: number, tag: number] {
  const [jahr, monat, tag] = datum.split('-').map(Number)
  return [jahr, monat, tag]
}

/**
 * Beginn des Termins als `Date` in der Zeitzone des Geräts.
 *
 * `datum` und `uhrzeit` sind **Ortszeit ohne Zone**; der Vertrag setzt Client und
 * Server in dieselbe Zeitzone (`Europe/Berlin`). Der Beginn wird deshalb aus den
 * Teilen gebaut: **`new Date('2026-09-01')` liest als UTC** und kann den Tag
 * verschieben. Sekunden in `uhrzeit` (`HH:MM:SS`) bleiben außer Acht.
 *
 * @param termin Datum und Uhrzeit des Termins.
 */
export function beginnVon(termin: Pick<TerminUebersicht, 'datum' | 'uhrzeit'>): Date {
  const [jahr, monat, tag] = datumsteile(termin.datum)
  const [stunde, minute] = termin.uhrzeit.split(':').map(Number)
  return new Date(jahr, monat - 1, tag, stunde, minute)
}

/**
 * Datum für Listen und Überschriften: „Di, 29. Juli“.
 *
 * Aus den Teilen von `Intl.DateTimeFormat` gesetzt: Der Formatierer schreibt
 * den Wochentag in `de-DE` mit Punkt („Di.“), den die Oberfläche nicht will.
 * Die Tageszeit des Hilfsdatums liegt mittags, damit keine Zeitumstellung den
 * Tag verschiebt.
 *
 * @param datum Datum `YYYY-MM-DD`.
 */
export function datumKurz(datum: string): string {
  const [jahr, monat, tag] = datumsteile(datum)
  const teile = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'long' })
    .formatToParts(new Date(jahr, monat - 1, tag, 12))
  const wert = (art: string) => teile.find((t) => t.type === art)?.value ?? ''
  return `${wert('weekday').replace(/\.$/, '')}, ${wert('day')}. ${wert('month')}`
}

/**
 * Datum ausgeschrieben für Screenreader: „Dienstag, 29. Juli“.
 *
 * @param datum Datum `YYYY-MM-DD`.
 */
export function datumLang(datum: string): string {
  const [jahr, monat, tag] = datumsteile(datum)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(jahr, monat - 1, tag, 12),
  )
}

/**
 * Uhrzeit ohne Sekunden: „19:00“.
 *
 * @param uhrzeit Uhrzeit `HH:MM` oder `HH:MM:SS`.
 */
export function uhrzeitKurz(uhrzeit: string): string {
  const [stunde, minute] = uhrzeit.split(':')
  return `${stunde.padStart(2, '0')}:${minute}`
}

/**
 * Zeitpunkt aus einem Zeitstempel des Servers in der Zeitzone des Geräts:
 * „29.07., 18:45 Uhr“ (Teileinteilung, Ergebnis).
 *
 * @param zeitstempel ISO-8601 mit Zone, wie ihn der Server liefert (`date-time`).
 */
export function zeitpunktKurz(zeitstempel: string): string {
  const teile = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(zeitstempel))
  const wert = (art: string) => teile.find((t) => t.type === art)?.value ?? ''
  return `${wert('day')}.${wert('month')}., ${wert('hour')}:${wert('minute')} Uhr`
}

/**
 * Wählt den „nächsten“ Termin: den ersten mit Status `GEPLANT` (E2).
 *
 * Die Liste kommt sortiert; **hier wird nicht neu sortiert.** Abgesagte Termine,
 * die davor liegen, gibt die Funktion getrennt zurück, damit die Oberfläche sie
 * als Hinweis zeigt. Gibt es keinen geplanten Termin, sind das alle abgesagten.
 * `ABGESCHLOSSEN` zählt nie. Ein begonnener, noch `GEPLANT`er Termin bleibt der
 * nächste, bis der Server ihn abschließt (30 bis 35 Minuten nach Beginn).
 *
 * @param liste Termine in Serverreihenfolge.
 */
export function naechsterTermin(liste: readonly TerminUebersicht[]): {
  termin: TerminUebersicht | undefined
  abgesagtDavor: TerminUebersicht[]
} {
  const index = liste.findIndex((t) => t.status === 'GEPLANT')
  const davor = index === -1 ? liste : liste.slice(0, index)
  return {
    termin: index === -1 ? undefined : liste[index],
    abgesagtDavor: davor.filter((t) => t.status === 'ABGESAGT'),
  }
}

/**
 * Heute als `YYYY-MM-DD` in der Ortszeit des Geräts.
 *
 * Nicht über `toISOString()`: Das ist UTC und liefert kurz nach Mitternacht
 * noch den Vortag.
 *
 * @param jetzt Der Zeitpunkt, für den das Datum gebildet wird.
 */
export function heuteIso(jetzt: Date): string {
  const monat = String(jetzt.getMonth() + 1).padStart(2, '0')
  const tag = String(jetzt.getDate()).padStart(2, '0')
  return `${jetzt.getFullYear()}-${monat}-${tag}`
}

/**
 * Stichtag für den Verlaufsabruf: heute minus `tage` (E14).
 *
 * @param jetzt Der Zeitpunkt, von dem aus zurückgerechnet wird.
 * @param tage Länge des Fensters; Vorgabe {@link VERLAUF_TAGE}.
 */
export function verlaufAb(jetzt: Date, tage = VERLAUF_TAGE): string {
  return heuteIso(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - tage))
}

/**
 * Vergangene Termine, neueste zuerst: `ABGESCHLOSSEN` sowie `ABGESAGT` mit
 * Beginn vor `jetzt`.
 *
 * **Kehrt die sortierte Eingabe um** (Kopie, kein erneutes Sortieren). Die
 * künftigen Termine der Antwort (`ab` hat keine Obergrenze) fallen heraus, ein
 * abgesagter künftiger Termin gehört nicht in den Verlauf.
 *
 * @param liste Termine in Serverreihenfolge (aufsteigend).
 * @param jetzt Der Zeitpunkt, ab dem ein Termin als vergangen gilt.
 */
export function vergangeneTermine(liste: readonly TerminUebersicht[], jetzt: Date): TerminUebersicht[] {
  return liste
    .filter(
      (t) => t.status === 'ABGESCHLOSSEN' || (t.status === 'ABGESAGT' && beginnVon(t).getTime() < jetzt.getTime()),
    )
    .reverse()
}

/**
 * Zuletzt abgeschlossener Termin: Grundlage des Tabs „Ergebnisse“ (E13).
 *
 * @param liste Termine in Serverreihenfolge (aufsteigend).
 */
export function letzterAbgeschlossener(liste: readonly TerminUebersicht[]): TerminUebersicht | undefined {
  return liste.findLast((t) => t.status === 'ABGESCHLOSSEN')
}
