import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { gastAbsagen, type GastAbsage } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Nimmt die Zusage eines Gastes zurück (`204`, Entscheidung vom 24.10.2026).
 *
 * Danach gehört der neue Teilnehmerkreis in alle Ansichten, die einen Termin zeigen (`termineNeuLesen`); die Mutation
 * bleibt `pending`, bis die Daten da sind. **Auch bei `404`** (der Gast ist schon nicht mehr dabei) und
 * **`409 TERMIN_GESCHLOSSEN`** (der Termin hat begonnen oder ist nicht mehr geplant) liest er neu: Beide Antworten
 * heißen, dass die Anzeige veraltet ist.
 */
export function useGastAbsagen(): UseMutationResult<void, Error, GastAbsage> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: GastAbsage) => gastAbsagen(anfrage),
    onSuccess: () => termineNeuLesen(queryClient),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (fehler.status === 404 || fehler.code === 'TERMIN_GESCHLOSSEN')) {
        return termineNeuLesen(queryClient)
      }
    },
  })
}
