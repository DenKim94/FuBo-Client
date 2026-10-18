import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { spielerBlockieren } from '@/api/admin/adminProfile'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'

/** Variablen von {@link useProfilBlockieren}. */
export type BlockierenVariablen = { spielerId: number; blockieren: boolean }

/**
 * Sperrt oder entsperrt ein Profil.
 *
 * Liest nach dem Erfolg `adminProfile` neu (Kennzeichen „gesperrt“ und „online“ ändern sich) und
 * bleibt bis dahin `pending`. Bei `404` wird die Liste neu gelesen.
 */
export function useProfilBlockieren(): UseMutationResult<void, Error, BlockierenVariablen> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ spielerId, blockieren }: BlockierenVariablen) => spielerBlockieren(spielerId, blockieren),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schluessel.adminProfile }),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && fehler.status === 404) {
        return queryClient.invalidateQueries({ queryKey: schluessel.adminProfile })
      }
    },
  })
}
