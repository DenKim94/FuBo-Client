import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { terminAendern, type TerminAendern } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import { termineNeuLesen } from './termineNeuLesen'

/** Fehlercodes, nach denen der Stand des Termins neu zu lesen ist: Er hat sich hinter dem Rücken geändert. */
const NEU_LESEN_BEI = new Set(['DATEN_VERALTET', 'TERMIN_GESCHLOSSEN'])

/**
 * Ändert einen Termin (Felder, Abschliessen).
 *
 * **Liest bei `DATEN_VERALTET` sofort neu** (E5), sonst bliebe der alte Stand stehen, und die Seite
 * baute das Formular nie mit dem frischen auf. Dasselbe bei `TERMIN_GESCHLOSSEN` und `404`.
 * Nach dem Erfolg liest er ebenfalls neu; die Mutation bleibt `pending`, bis die Daten da sind.
 * **Sendet nie selbstständig mit der neuen `version` und den alten Eingaben erneut.**
 */
export function useTerminAendern(): UseMutationResult<void, Error, TerminAendern> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: TerminAendern) => terminAendern(anfrage),
    onSuccess: () => termineNeuLesen(queryClient),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (NEU_LESEN_BEI.has(fehler.code) || fehler.status === 404)) {
        return termineNeuLesen(queryClient)
      }
    },
  })
}
