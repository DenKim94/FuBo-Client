import type { QueryClient } from '@tanstack/react-query'
import { schluessel } from '@/api/common/schluessel'

/**
 * Liest alles neu, was einen Termin zeigt: die Liste, alle Einzeltermine und den Verlauf.
 *
 * **Einmal an einem Ort** (wie `neuLesen` in `useRueckmeldung`): Die fünf Schreibhooks der
 * Terminverwaltung brauchen dieselbe Gruppe. Ein Schlüssel zu vergessen ließe genau eine Ansicht
 * mit altem Stand stehen, ohne Fehlermeldung (Falle aus C1: `invalidateQueries` lädt nur
 * **beobachtete** Abfragen neu, die anderen gelten als veraltet und laden beim nächsten Einhängen).
 *
 * **Gibt das Versprechen zurück:** Hängt es ein Hook als Rückgabe von `onSuccess` ein, bleibt die
 * Mutation `pending`, bis die Daten da sind, und ein Dialog zeigt den neuen Stand statt des alten.
 *
 * @param queryClient Der Client, dessen Abfragen ungültig werden.
 */
export function termineNeuLesen(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: schluessel.termine }),
    queryClient.invalidateQueries({ queryKey: schluessel.terminAlle }),
    queryClient.invalidateQueries({ queryKey: schluessel.termineVerlauf }),
  ])
}
