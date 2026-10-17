import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { rueckmeldungSenden } from '@/api/termine/termine'

/**
 * Sendet die eigene Zu- oder Absage zu einem Termin (A7).
 *
 * Aufgerufen mit `mutate(zusage)`. **Kein Cache wird von Hand gesetzt** (E4):
 * Die Antwort `204` enthält keine neue Liste, und Position und Warteschlange
 * hängen am Server. Stattdessen werden Liste und Einzeltermine neu gelesen; der
 * Rückgabewert der Mutation ist keine Wahrheit.
 *
 * **Auch bei `409` und `404` wird neu gelesen:** Die Antwort sagt, dass die
 * Anzeige veraltet war (der Termin hat begonnen, wurde abgesagt oder entfernt).
 * Bei Netzfehlern und `≥ 500` bleibt der Stand, der zweite Tipp wiederholt.
 *
 * Die Mutation bleibt `isPending`, bis die neuen Daten da sind: Die Schaltfläche
 * zeigt den Ladezustand, und der Fokus wandert erst, wenn die Anzeige stimmt.
 *
 * @param terminId Technischer Schlüssel des Termins.
 */
export function useRueckmeldung(terminId: number): UseMutationResult<void, Error, boolean> {
  const queryClient = useQueryClient()

  /** Liest Liste und alle Einzeltermine neu (`invalidateQueries` lädt nur beobachtete Abfragen). */
  function neuLesen() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: schluessel.termine }),
      queryClient.invalidateQueries({ queryKey: schluessel.terminAlle }),
    ])
  }

  return useMutation({
    mutationFn: (zusage: boolean) => rueckmeldungSenden(terminId, zusage),
    onSuccess: neuLesen,
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (fehler.status === 409 || fehler.status === 404)) return neuLesen()
    },
  })
}
