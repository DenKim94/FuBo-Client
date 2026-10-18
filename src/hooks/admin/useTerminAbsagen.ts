import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { terminAbsagen } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Sagt einen geplanten Termin ab (endgültig, ohne `version`).
 *
 * Liest nach dem Erfolg die Termine neu; die Mutation bleibt `pending`, bis der Dialog den neuen
 * Stand zeigen kann. Bei `409 TERMIN_GESCHLOSSEN` (schon abgesagt oder abgeschlossen) und `404`
 * liest er ebenfalls neu, damit die Seite den tatsächlichen Stand zeigt.
 */
export function useTerminAbsagen(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (terminId: number) => terminAbsagen(terminId),
    onSuccess: () => termineNeuLesen(queryClient),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (fehler.code === 'TERMIN_GESCHLOSSEN' || fehler.status === 404)) {
        return termineNeuLesen(queryClient)
      }
    },
  })
}
