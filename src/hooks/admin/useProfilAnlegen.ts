import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { spielerAnlegen, type SpielerAngelegt, type SpielerAnlegen } from '@/api/admin/adminProfile'
import { schluessel } from '@/api/common/schluessel'

/**
 * Legt ein Profil an.
 *
 * Aufgerufen mit `mutateAsync({ name, skills })`; **der Aufrufer verschwindet nach dem Erfolg**
 * (Weiterleitung zur Liste), deshalb `mutateAsync` mit `try`/`catch` statt `mutate(…, { onSuccess })`
 * – dessen Rückruf ginge verloren (C5-Falle).
 *
 * Liest nach dem Erfolg `adminProfile` neu und bleibt bis dahin `pending`, damit die Liste
 * beim Eintreffen das neue Profil schon zeigt. Kein zweiter Versuch bei `500`.
 */
export function useProfilAnlegen(): UseMutationResult<SpielerAngelegt, Error, SpielerAnlegen> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: SpielerAnlegen) => spielerAnlegen(anfrage),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: schluessel.adminProfile }),
  })
}
