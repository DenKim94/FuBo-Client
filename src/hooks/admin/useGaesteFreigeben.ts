import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { gaesteFreigeben } from '@/api/admin/adminKonfiguration'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'

/**
 * Gibt einzelne Gastplätze frei (`204`); **der Aufruf meldet den Gast ab**, dessen Sitzung am Platz hängt.
 *
 * Der Hook nimmt nur Platznummern (`slotIds`) entgegen: `alle: true` (E15) ist über ihn nicht zu erreichen, weil es
 * auch Gäste mit lebender Sitzung abmeldete. Liest nach dem Erfolg die Plätze neu; bei `400` (eine Nummer gibt es
 * nicht mehr) ebenfalls, damit die Liste den tatsächlichen Stand zeigt.
 */
export function useGaesteFreigeben(): UseMutationResult<void, Error, number[]> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slotIds: number[]) => gaesteFreigeben({ slotIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schluessel.adminGaeste }),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && fehler.status === 400) {
        return queryClient.invalidateQueries({ queryKey: schluessel.adminGaeste })
      }
    },
  })
}
