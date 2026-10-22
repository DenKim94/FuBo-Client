import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { konfigurationAendern, type KonfigurationAnfrage } from '@/api/admin/adminKonfiguration'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Schreibt die Konfiguration als Voll-Update (`204`).
 *
 * **Liest nach dem Erfolg neu, was von den Werten abhängt**, und die Mutation bleibt bis dahin `pending`:
 * - die Konfiguration selbst (neue `version`, `halleAbsageVorlageEffektiv`),
 * - die Termine (`minTeilnehmer`/`maxTeilnehmer` wirken auf `wartet` und den Balken),
 * - die Restlaufzeit der Sitzung (`sessionLeerlaufMinuten` wirkt sofort, auch auf die eigene Sitzung).
 *
 * **Bei `409 DATEN_VERALTET`** liest er die Konfiguration sofort neu (E5): Das Formular setzt sich dann auf den
 * frischen Stand zurück; es wird nie mit der neuen `version` und den alten Eingaben gesendet.
 */
export function useKonfigurationAendern(): UseMutationResult<void, Error, KonfigurationAnfrage> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: KonfigurationAnfrage) => konfigurationAendern(anfrage),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: schluessel.adminKonfiguration }),
        termineNeuLesen(queryClient),
        queryClient.invalidateQueries({ queryKey: schluessel.sitzungFrist }),
      ]),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && fehler.code === 'DATEN_VERALTET') {
        return queryClient.invalidateQueries({ queryKey: schluessel.adminKonfiguration })
      }
    },
  })
}
