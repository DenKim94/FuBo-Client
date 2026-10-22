import { beginnVon } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import { useZeitpunktErreicht } from './useZeitpunktErreicht'

/**
 * Sagt, ob der Beginn des Termins zurückliegt (E8).
 *
 * **Aus der Geräteuhr abgeleitet und nur Darstellung:** Ab Beginn verschwindet
 * die Aktionsleiste, und ein Satz sagt, dass Rückmeldungen nicht mehr möglich
 * sind. Der Server entscheidet weiter (`409 TERMIN_GESCHLOSSEN`); wie beim
 * Ablauf-Dialog ordnet die Uhr die Anzeige, nicht die Berechtigung.
 *
 * Seit C8 ein dünner Aufruf von {@link useZeitpunktErreicht} mit dem Beginn des Termins; Timer,
 * `useSyncExternalStore` und das Verhalten (Umschalten ohne Neuladen, Aufräumen, Nachplanen) stehen dort.
 *
 * @param termin Datum und Uhrzeit des Termins; `undefined` solange er nicht geladen ist.
 * @returns `true`, sobald der Beginn erreicht ist.
 */
export function useBegonnen(termin: Pick<TerminUebersicht, 'datum' | 'uhrzeit'> | undefined): boolean {
  return useZeitpunktErreicht(termin ? beginnVon(termin).getTime() : undefined)
}
