import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { serieAnlegen, type SerieAngelegt, type SerieAnlegen } from '@/api/admin/adminTermine'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Legt eine Terminserie an (bis zu 52 Termine auf einmal).
 *
 * Liest nach dem Erfolg die Termine neu ({@link termineNeuLesen}); das Ergebnis (angelegte und
 * übersprungene Zeitpunkte) erscheint damit auf aktuellem Stand. Aufgerufen mit `mutateAsync` im
 * `try`/`catch`: Der Dialog, aus dem der Aufruf kommt, schliesst sich mit dem Erfolg.
 */
export function useSerieAnlegen(): UseMutationResult<SerieAngelegt, Error, SerieAnlegen> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: SerieAnlegen) => serieAnlegen(anfrage),
    onSuccess: () => termineNeuLesen(queryClient),
  })
}
