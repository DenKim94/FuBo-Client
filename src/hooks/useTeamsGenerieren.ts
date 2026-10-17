import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { teamsGenerieren, type Teameinteilung } from '@/api/teams/teams'

/**
 * Löst die Teameinteilung eines Termins aus (A20a).
 *
 * Aufgerufen mit `mutate()`. **Kein Cache wird von Hand gesetzt** (E4): Die
 * Antwort ist die neue Einteilung, die Wahrheit bleibt der Einzeltermin, und
 * dort hängen `veraltet` und die Liste der Zusagen mit dran. Stattdessen werden
 * Einzeltermin und Liste neu gelesen.
 *
 * **Auch bei `409` und `404` wird neu gelesen:** Die Antwort sagt, dass die
 * Anzeige veraltet war – der Termin hat begonnen, die Liste hat sich geändert
 * (`TEILNEHMER_GEAENDERT`), jemand war schneller. Bei Netzfehlern und `≥ 500`
 * bleibt der Stand; ein zweiter Tipp wiederholt. **Mutationen werden nie
 * automatisch wiederholt:** Ein Lauf verbraucht Kontingent.
 *
 * Die Mutation bleibt `isPending`, bis die neuen Daten da sind: Die Schaltfläche
 * zeigt den Ladezustand, und der Fokus wandert erst, wenn die Einteilung steht.
 * Die Sperre nach `KONTINGENT_ERSCHOEPFT` hält die Seite, nicht dieser Hook.
 *
 * @param terminId Technischer Schlüssel des Termins.
 */
export function useTeamsGenerieren(terminId: number): UseMutationResult<Teameinteilung, Error, void> {
  const queryClient = useQueryClient()

  /** Liest Einzeltermin und Liste neu (`invalidateQueries` lädt nur beobachtete Abfragen). */
  function neuLesen() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: schluessel.termin(String(terminId)) }),
      queryClient.invalidateQueries({ queryKey: schluessel.termine }),
    ])
  }

  return useMutation({
    mutationFn: () => teamsGenerieren(terminId),
    onSuccess: neuLesen,
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (fehler.status === 409 || fehler.status === 404)) return neuLesen()
    },
  })
}
