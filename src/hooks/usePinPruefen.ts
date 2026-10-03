import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { pinPruefen } from '@/api/auth/auth'
import { schluessel } from '@/api/common/schluessel'

/**
 * Führt die erste Stufe des Logins aus: die Prüfung der zentralen PIN (A1/A3).
 *
 * Eine Mutation und keine Abfrage, weil der Aufruf etwas verändert – er legt
 * serverseitig eine Sitzung an. Aufgerufen wird mit `mutate(pin)`; Ladezustand
 * und Fehler stehen in `isPending` und `error`.
 *
 * **Nach dem Erfolg:**
 * 1. Alle zwischengespeicherten Daten ausser der Sitzung werden entfernt. Der
 *    Server widerruft bei der PIN-Prüfung eine bestehende Sitzung; was der Cache
 *    noch hält, gehört damit zu einer Identität, die es nicht mehr gibt.
 * 2. Ein noch laufender Sitzungsabruf wird abgebrochen. Er wurde vor der
 *    PIN-Prüfung gestellt und liefert den alten Stand. Ohne den Abbruch hängte
 *    sich das Neulesen an ihn an, solange noch keine Sitzungsdaten vorliegen –
 *    beim ersten Laden über ein langsames Netz bliebe die Ansicht dann auf
 *    „nicht angemeldet" stehen.
 * 3. Die Sitzung wird neu gelesen, und die Mutation wartet darauf. Erst danach
 *    meldet `useSitzung` die Stufe `PIN_VERIFIED`. Ohne das Warten wäre
 *    `isSuccess` schon gesetzt, während die Sitzung noch den alten Stand zeigt –
 *    eine Ansicht, die dann zur Namensauswahl wechselt, sähe dort für einen
 *    Augenblick „nicht angemeldet".
 *
 * **Fehler** kommen als `ApiFehler` (Prüfung mit `instanceof`): `PIN_FALSCH`,
 * `PIN_GESPERRT` mit `wartesekunden`, `EINGABE_UNGUELTIG`. Angezeigt wird
 * `error.message` (der Text des Servers), verzweigt wird über `error.code`.
 * Die globale Behandlung in `queryClient.ts` wertet `PIN_FALSCH` bewusst nicht
 * als Sitzungsende. Ein automatischer zweiter Versuch findet nicht statt
 * (Vorgabe für Mutationen) – bei `429` verlängerte er die Sperre.
 *
 * @returns Das Mutationsobjekt von TanStack Query; die Variable ist die PIN.
 */
export function usePinPruefen(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    // Gekapselt statt `mutationFn: pinPruefen`: TanStack Query übergibt weitere
    // Argumente, die so nicht in die API-Funktion durchgereicht werden (C1).
    mutationFn: (pin: string) => pinPruefen(pin),
    onSuccess: async () => {
      queryClient.removeQueries({
        predicate: (abfrage) => abfrage.queryKey[0] !== schluessel.sitzung[0],
      })
      // Punkt 2: Der laufende Abruf stammt aus der Zeit vor der PIN-Prüfung.
      await queryClient.cancelQueries({ queryKey: schluessel.sitzung })
      // Punkt 3, `await`: Die Mutation gilt erst als erfolgreich, wenn die neue
      // Sitzung gelesen ist.
      await queryClient.invalidateQueries({ queryKey: schluessel.sitzung })
    },
  })
}
