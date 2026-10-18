import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { ApiFehler } from '@/api/common/fehler'
import { spielerBearbeiten, type SpielerBearbeiten } from '@/api/admin/adminProfile'
import { schluessel } from '@/api/common/schluessel'

/**
 * Ändert ein Profil (nur das Geänderte, E6).
 *
 * **Liest nach dem Erfolg neu:** `adminProfile` (das Formular baut sich aus dem neuen Stand auf)
 * und `terminAlle` – Skillwerte ändern die `teilnehmerVersion` künftiger Termine, und eine
 * geöffnete Termin-Ansicht soll die veraltete Einteilung nicht als aktuell zeigen. Die Mutation
 * bleibt `pending`, bis beides gelesen ist.
 *
 * Bei `404` (das Profil ist weg) wird die Liste ebenfalls neu gelesen; die Seite führt zur Liste.
 */
export function useProfilBearbeiten(): UseMutationResult<void, Error, SpielerBearbeiten> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: SpielerBearbeiten) => spielerBearbeiten(anfrage),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: schluessel.adminProfile }),
        queryClient.invalidateQueries({ queryKey: schluessel.terminAlle }),
      ]),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && fehler.status === 404) {
        return queryClient.invalidateQueries({ queryKey: schluessel.adminProfile })
      }
    },
  })
}
