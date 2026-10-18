import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { terminAnlegen, type TerminAngelegt, type TerminAnlegen } from '@/api/admin/adminTermine'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Legt einen Einzeltermin an.
 *
 * Aufgerufen mit `mutateAsync` im `try`/`catch`: **Die Seite verschwindet** nach dem Erfolg
 * (Weiterleitung zur Verwaltung des neuen Termins), `mutate(…, { onSuccess })` verlöre den Rückruf.
 * Liest nach dem Erfolg `termine`, `terminAlle` und `termineVerlauf` neu ({@link termineNeuLesen});
 * die Mutation bleibt `pending`, bis die Daten da sind. Bei `409 TERMIN_BELEGT` ändert sich nichts.
 */
export function useTerminAnlegen(): UseMutationResult<TerminAngelegt, Error, TerminAnlegen> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: TerminAnlegen) => terminAnlegen(anfrage),
    onSuccess: () => termineNeuLesen(queryClient),
  })
}
