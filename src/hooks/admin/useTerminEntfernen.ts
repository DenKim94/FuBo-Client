import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { terminEntfernen } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Entfernt einen Termin, an dem nichts hängt.
 *
 * Aufgerufen mit `mutateAsync` im `try`/`catch`: **Der Aufrufer verschwindet** (Weiterleitung zur
 * Liste). Liest nach dem Erfolg die Termine neu. Bei `409 TERMIN_IN_VERWENDUNG` und `404` liest er
 * ebenfalls neu: Die Seite bietet dann „Stattdessen absagen“ nur an, wenn der Termin noch
 * `GEPLANT` ist, und das muss der aktuelle Stand sagen.
 */
export function useTerminEntfernen(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (terminId: number) => terminEntfernen(terminId),
    onSuccess: () => termineNeuLesen(queryClient),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (fehler.code === 'TERMIN_IN_VERWENDUNG' || fehler.status === 404)) {
        return termineNeuLesen(queryClient)
      }
    },
  })
}
