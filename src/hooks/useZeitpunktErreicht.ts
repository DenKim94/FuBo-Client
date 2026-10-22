import { useCallback, useSyncExternalStore } from 'react'

/** Größte Wartezeit, die `setTimeout` zuverlässig verträgt (rund 24,8 Tage). */
const MAX_WARTEZEIT_MS = 2 ** 31 - 1

/**
 * Sagt, ob ein Zeitpunkt erreicht ist, und schaltet **von selbst** um (E8, C8 5.5).
 *
 * **Aus der Geräteuhr abgeleitet und nur Darstellung:** Der Server entscheidet weiter (`409`); wie beim Ablauf-Dialog
 * ordnet die Uhr die Anzeige, nicht die Berechtigung. Verallgemeinert `useBegonnen` (Beginn eines Termins) auf jeden
 * Zeitpunkt, etwa die Frist der Hallenabsage.
 *
 * Der Hook plant einen Timer bis zum Zeitpunkt, damit die Anzeige **ohne Neuladen** umspringt, und räumt ihn auf.
 * Über `useSyncExternalStore`, weil die Uhr eine Quelle außerhalb von React ist: So wird beim Rendern keine Uhrzeit
 * gelesen (react-hooks v7 verbietet es) und beim Wechsel des Zeitpunkts nichts mitgeschleppt. Liegt der Zeitpunkt weiter
 * entfernt, als ein Timer reicht, plant der Hook nach. Ein ungültiger Zeitpunkt (`NaN`) gilt als nicht erreicht und
 * plant nichts.
 *
 * @param zeitpunkt Millisekunden seit 1970; `undefined`, solange er nicht bekannt ist.
 * @returns `true`, sobald der Zeitpunkt erreicht ist.
 */
export function useZeitpunktErreicht(zeitpunkt: number | undefined): boolean {
  const gueltig = zeitpunkt !== undefined && !Number.isNaN(zeitpunkt) ? zeitpunkt : undefined

  const abonnieren = useCallback(
    (melden: () => void) => {
      if (gueltig === undefined) return () => {}
      let timer: ReturnType<typeof setTimeout> | undefined
      const planen = () => {
        const rest = gueltig - Date.now()
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
    [gueltig],
  )

  const stand = useCallback(() => gueltig !== undefined && Date.now() >= gueltig, [gueltig])

  return useSyncExternalStore(abonnieren, stand, () => false)
}
