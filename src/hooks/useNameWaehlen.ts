import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { nameWaehlen } from '@/api/auth/auth'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { useSitzungswechsel } from '@/hooks/useSitzungswechsel'

/**
 * Zweite Stufe des Logins: übernimmt ein Profil aus der Namensliste (A4).
 *
 * Aufgerufen mit `mutate(spielerId)`. Nach dem Erfolg läuft der gemeinsame
 * Stufenwechsel; `useSitzung` meldet dann `PROFILE_AUTHENTICATED`, und
 * `LoginSchrittRoute` leitet zur Startseite (oder zur ursprünglich
 * angesteuerten Ansicht) weiter.
 *
 * **Bei `NAME_BELEGT` oder `INHALT_NICHT_GEFUNDEN`** wird die Namensliste sofort
 * neu gelesen, statt auf den nächsten Polling-Takt zu warten: Der Server hat
 * gerade belegt, dass die angezeigte Liste veraltet ist. Der Name erscheint so
 * unmittelbar ausgegraut beziehungsweise verschwindet.
 *
 * @returns Das Mutationsobjekt; die Variable ist die Id des Profils.
 */
export function useNameWaehlen(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  const stufeGewechselt = useSitzungswechsel()

  return useMutation({
    mutationFn: (spielerId: number) => nameWaehlen(spielerId),
    onSuccess: () => stufeGewechselt(),
    onError: (fehler) => {
      if (
        fehler instanceof ApiFehler &&
        (fehler.code === 'NAME_BELEGT' || fehler.code === 'INHALT_NICHT_GEFUNDEN')
      ) {
        void queryClient.invalidateQueries({ queryKey: schluessel.namensliste })
      }
    },
  })
}
