import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { schluessel } from '@/api/common/schluessel'
import { pushAboAnlegen } from '@/api/push/push'
import { GeraetFehler, abonnieren, berechtigungErfragen, kuendigen, type Berechtigung } from '@/pwa/pushGeraet'

/** Eingabe der Mutation: Die Anfrage der Berechtigung läuft schon (siehe {@link usePushEinrichten}). */
type Eingabe = { vapid: string; anfrage: Promise<Berechtigung> }

/** Text, wenn die Berechtigung nicht erteilt wurde. */
function ohneBerechtigung(berechtigung: Berechtigung): GeraetFehler {
  return berechtigung === 'denied'
    ? new GeraetFehler(
        'abgelehnt',
        'Benachrichtigungen sind im Browser blockiert. Erlaube sie in den Einstellungen des Browsers für diese Seite.',
      )
    : new GeraetFehler('geschlossen', 'Du hast die Frage nach Benachrichtigungen geschlossen. Du kannst es erneut versuchen.')
}

/**
 * Richtet dieses Gerät für Benachrichtigungen ein (C9, E26).
 *
 * Reihenfolge: (1) Schlüssel ist **vorher** geladen, (2) Berechtigung erfragen, (3) auf den Service Worker warten,
 * (4) ein Abonnement mit anderem Schlüssel kündigen, (5) abonnieren, (6) `POST /push/abo/anlegen`. **Scheitert (6),
 * wird das Browser-Abonnement wieder gekündigt** – sonst zeigte das Gerät „eingerichtet“, während der Server nichts weiß.
 *
 * **Die Berechtigung wird synchron im Klick erfragt, nicht in `mutationFn`.** TanStack Query wartet vor dem Aufruf
 * von `mutationFn` auf `onMutate` (`await` in `Mutation.execute`, auch ohne `onMutate`); `requestPermission` liefe dann
 * nicht mehr im Aufrufstapel des Klicks, und Safari verlöre die Nutzergeste (P11). `einrichten` ruft die Anfrage
 * deshalb **vor** `mutateAsync` und reicht das Versprechen durch. Abweichung von der Anleitung (5), gleiche Absicht.
 *
 * Nach dem Ende (Erfolg wie Fehler) wird der Gerätezustand neu gelesen; die Mutation bleibt bis dahin `pending`.
 */
export function usePushEinrichten() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ vapid, anfrage }: Eingabe) => {
      const berechtigung = await anfrage
      if (berechtigung !== 'granted') throw ohneBerechtigung(berechtigung)
      const abo = await abonnieren(vapid)
      try {
        return await pushAboAnlegen(abo)
      } catch (fehler) {
        // Rücknahme (E26). Scheitert auch sie, bleibt der Fehler des Servers die Aussage.
        await kuendigen().catch(() => null)
        throw fehler
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: schluessel.pushGeraet }),
  })

  const { mutateAsync } = mutation
  /**
   * **Synchron aus dem Klick aufrufen**, ohne `await` davor.
   *
   * @param vapid Der vorher geladene Schlüssel des Servers.
   * @returns `true` bei Erfolg; einen Fehler zeigt `fehler`.
   */
  const einrichten = useCallback(
    (vapid: string): Promise<boolean> => {
      const anfrage = berechtigungErfragen()
      return mutateAsync({ vapid, anfrage }).then(
        () => true,
        () => false,
      )
    },
    [mutateAsync],
  )

  return { einrichten, laedt: mutation.isPending, fehler: mutation.error, zuruecksetzen: mutation.reset }
}
