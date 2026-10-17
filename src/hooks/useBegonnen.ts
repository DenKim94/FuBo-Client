import { useCallback, useSyncExternalStore } from 'react'
import { beginnVon } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'

/** Größte Wartezeit, die `setTimeout` zuverlässig verträgt (rund 24,8 Tage). */
const MAX_WARTEZEIT_MS = 2 ** 31 - 1

/**
 * Sagt, ob der Beginn des Termins zurückliegt (E8).
 *
 * **Aus der Geräteuhr abgeleitet und nur Darstellung:** Ab Beginn verschwindet
 * die Aktionsleiste, und ein Satz sagt, dass Rückmeldungen nicht mehr möglich
 * sind. Der Server entscheidet weiter (`409 TERMIN_GESCHLOSSEN`); wie beim
 * Ablauf-Dialog ordnet die Uhr die Anzeige, nicht die Berechtigung.
 *
 * Der Hook plant einen Timer bis zum Beginn, damit die Leiste **ohne Neuladen**
 * verschwindet, und räumt ihn auf. Über `useSyncExternalStore`, weil die Uhr
 * eine Quelle außerhalb von React ist: So wird beim Rendern keine Uhrzeit gelesen
 * und beim Wechsel des Termins nichts mitgeschleppt. Liegt der Beginn weiter
 * als ein Timer reicht, plant der Hook nach.
 *
 * @param termin Datum und Uhrzeit des Termins; `undefined` solange er nicht geladen ist.
 * @returns `true`, sobald der Beginn erreicht ist.
 */
export function useBegonnen(termin: Pick<TerminUebersicht, 'datum' | 'uhrzeit'> | undefined): boolean {
  const beginn = termin ? beginnVon(termin).getTime() : undefined

  const abonnieren = useCallback(
    (melden: () => void) => {
      if (beginn === undefined) return () => {}
      let timer: ReturnType<typeof setTimeout> | undefined
      const planen = () => {
        const rest = beginn - Date.now()
        if (rest <= 0) return
        timer = setTimeout(
          () => {
            melden()
            planen()
          },
          Math.min(rest, MAX_WARTEZEIT_MS),
        )
      }
      planen()
      return () => clearTimeout(timer)
    },
    [beginn],
  )

  const stand = useCallback(() => beginn !== undefined && Date.now() >= beginn, [beginn])

  return useSyncExternalStore(abonnieren, stand, () => false)
}
