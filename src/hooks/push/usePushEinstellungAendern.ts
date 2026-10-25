import { useMutation, useQueryClient } from '@tanstack/react-query'
import { schluessel } from '@/api/common/schluessel'
import { pushEinstellungAendern, type PushStatus } from '@/api/push/push'

/**
 * Setzt den Personenschalter (C9, E28, P5).
 *
 * Die Anzeige folgt der **Antwort** (dem gespeicherten Stand), nicht dem gesendeten Wert: `setQueryData` schreibt
 * `pushErwuenscht` aus der Antwort in den Status. Kein Neulesen danach – die Antwort ist der Stand.
 */
export function usePushEinstellungAendern() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pushErwuenscht: boolean) => pushEinstellungAendern(pushErwuenscht),
    onSuccess: (antwort) => {
      queryClient.setQueryData<PushStatus>(schluessel.pushStatus, (alt) =>
        alt ? { ...alt, pushErwuenscht: antwort.pushErwuenscht } : alt,
      )
    },
  })
}
