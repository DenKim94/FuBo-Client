import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { schluessel } from '@/api/common/schluessel'
import { pushAboEntfernen } from '@/api/push/push'
import { kuendigen } from '@/pwa/pushGeraet'

/**
 * Entfernt dieses Gerät aus den Benachrichtigungen (C9, E27).
 *
 * **Erst der Browser (`unsubscribe()`), dann `POST /push/abo/entfernen`.** Umgekehrt ließe ein gescheitertes
 * `unsubscribe()` das Abonnement im Browser stehen, und der nächste Start-Abgleich meldete es dem Server wieder an.
 * Ein Serverfehler danach wird gezeigt, ist aber unschädlich: Die verwaiste Zeile beantwortet der Push-Dienst mit
 * `410`, und der Server deaktiviert sie.
 */
export function usePushEntfernen() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => {
      const endpoint = await kuendigen()
      if (endpoint !== null) await pushAboEntfernen(endpoint)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: schluessel.pushGeraet }),
  })
  const { mutateAsync } = mutation
  /** @returns `true` bei Erfolg; einen Fehler zeigt `fehler`. */
  const entfernen = useCallback(
    (): Promise<boolean> =>
      mutateAsync().then(
        () => true,
        () => false,
      ),
    [mutateAsync],
  )
  return { entfernen, laedt: mutation.isPending, fehler: mutation.error, zuruecksetzen: mutation.reset }
}
