import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { schluessel } from '@/api/common/schluessel'

/**
 * Liefert die Aufräumarbeit nach einem Wechsel der Login-Stufe.
 *
 * Gebraucht von allen Aufrufen, die die Sitzung auf eine neue Stufe heben:
 * PIN-Prüfung, Namensauswahl, Gastanmeldung (und ab C4 die Admin-Anmeldung).
 * Steht hier einmal, damit die drei Schritte nicht in jedem Hook auseinanderlaufen:
 *
 * 1. **Alle zwischengespeicherten Daten ausser der Sitzung entfernen.** Sie
 *    gehören zur vorigen Stufe oder – bei der PIN-Prüfung, die eine bestehende
 *    Sitzung widerruft – zu einer Identität, die es nicht mehr gibt.
 * 2. **Einen laufenden Sitzungsabruf abbrechen.** Er wurde vor dem Wechsel
 *    gestellt und liefert den alten Stand. Ohne den Abbruch hängte sich das
 *    Neulesen an ihn an, solange noch keine Sitzungsdaten vorliegen.
 * 3. **Die Sitzung neu lesen** und auf das Ergebnis warten. Ruft der Hook die
 *    Funktion in `onSuccess` mit `await` auf, meldet die Mutation ihren Erfolg
 *    erst, wenn `useSitzung` die neue Stufe kennt – und die Guards leiten im
 *    selben Zug richtig weiter.
 *
 * @returns Eine stabile asynchrone Funktion ohne Parameter.
 */
export function useSitzungswechsel(): () => Promise<void> {
  const queryClient = useQueryClient()

  return useCallback(async () => {
    queryClient.removeQueries({
      predicate: (abfrage) => abfrage.queryKey[0] !== schluessel.sitzung[0],
    })
    await queryClient.cancelQueries({ queryKey: schluessel.sitzung })
    await queryClient.invalidateQueries({ queryKey: schluessel.sitzung })
  }, [queryClient])
}
