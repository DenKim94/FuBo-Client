import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { gastStufeAendern, type GastStufeAenderung } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Ändert die Skill-Stufe eines Gastes an einer Teilnahme (`204`, E13).
 *
 * Die Änderung erhöht die `teilnehmerVersion` des Termins: Sie gehört in alle Ansichten, die einen Termin zeigen
 * (`termineNeuLesen`), und in die Gastplätze (dort steht die Stufe ebenfalls). Die Mutation bleibt `pending`, bis
 * die Daten da sind. Bei `404` (der Gast hat sich inzwischen abgemeldet) liest er den Termin ebenfalls neu.
 */
export function useGastStufe(): UseMutationResult<void, Error, GastStufeAenderung> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: GastStufeAenderung) => gastStufeAendern(anfrage),
    onSuccess: () => Promise.all([termineNeuLesen(queryClient), queryClient.invalidateQueries({ queryKey: schluessel.adminGaeste })]),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && fehler.status === 404) return termineNeuLesen(queryClient)
    },
  })
}
