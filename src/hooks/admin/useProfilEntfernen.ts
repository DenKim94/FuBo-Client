import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { spielerEntfernen } from '@/api/admin/adminProfile'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'

/**
 * Entfernt ein Profil, das noch nie benutzt wurde.
 *
 * Aufgerufen mit `mutateAsync(spielerId)`: **Der Aufrufer verschwindet** (Weiterleitung zur
 * Liste), `mutate(…, { onSuccess })` verlöre den Rückruf. Liest nach dem Erfolg `adminProfile`
 * neu; bei `404` ebenfalls. Bei `409 PROFIL_IN_VERWENDUNG` ändert sich nichts.
 */
export function useProfilEntfernen(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (spielerId: number) => spielerEntfernen(spielerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schluessel.adminProfile }),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && fehler.status === 404) {
        return queryClient.invalidateQueries({ queryKey: schluessel.adminProfile })
      }
    },
  })
}
