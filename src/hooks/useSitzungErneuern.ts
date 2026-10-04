import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { sitzungErneuern } from '@/api/auth/auth'
import { schluessel } from '@/api/common/schluessel'

/**
 * Verlängert die Sitzung ausdrücklich („Sitzung verlängern", A14).
 *
 * Aufgerufen mit `mutate()`. **Nach dem Erfolg** liest der Hook die
 * Restlaufzeit neu und meldet Erfolg erst, wenn sie da ist: Der Dialog schliesst
 * damit auf Grund des neuen Standes und nicht auf Verdacht. Schiebt der Server
 * das Ende nur bis zur harten Obergrenze (`gueltigBis` wird dorthin geklemmt),
 * sieht der Dialog das im selben Zug und wechselt in den Fall „nicht mehr
 * verlängerbar", statt eine Verlängerung vorzutäuschen.
 *
 * Ein laufender Abruf der Restlaufzeit wird vorher abgebrochen: Er wurde vor
 * der Verlängerung gestellt und brächte den alten Stand zurück (dieselbe Falle
 * wie beim Stufenwechsel, `useSitzungswechsel`).
 *
 * **Fehler** kommen als `ApiFehler`; `401 SESSION_UNGUELTIG` (inzwischen
 * abgelaufen) geht zusätzlich in die globale Behandlung und führt zur
 * PIN-Eingabe. Ein automatischer zweiter Versuch findet nicht statt (Vorgabe
 * für Mutationen).
 */
export function useSitzungErneuern(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => sitzungErneuern(),
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: schluessel.sitzungFrist })
      await queryClient.invalidateQueries({ queryKey: schluessel.sitzungFrist })
    },
  })
}
