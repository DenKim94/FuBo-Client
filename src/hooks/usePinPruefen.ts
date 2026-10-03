import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { pinPruefen } from '@/api/auth/auth'
import { useSitzungswechsel } from '@/hooks/useSitzungswechsel'

/**
 * Führt die erste Stufe des Logins aus: die Prüfung der zentralen PIN (A1/A3).
 *
 * Eine Mutation und keine Abfrage, weil der Aufruf etwas verändert – er legt
 * serverseitig eine Sitzung an. Aufgerufen wird mit `mutate(pin)`; Ladezustand
 * und Fehler stehen in `isPending` und `error`.
 *
 * **Nach dem Erfolg** läuft der gemeinsame Stufenwechsel (`useSitzungswechsel`):
 * Daten der früheren Identität entfernen – der Server widerruft bei der
 * PIN-Prüfung eine bestehende Sitzung –, einen laufenden Sitzungsabruf
 * abbrechen und die Sitzung neu lesen. `isSuccess` wird erst danach gesetzt;
 * dann meldet `useSitzung` bereits `PIN_VERIFIED`, und `LoginSchrittRoute`
 * leitet zur Namensauswahl um.
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
  const stufeGewechselt = useSitzungswechsel()

  return useMutation({
    // Gekapselt statt `mutationFn: pinPruefen`: TanStack Query übergibt weitere
    // Argumente, die so nicht in die API-Funktion durchgereicht werden (C1).
    mutationFn: (pin: string) => pinPruefen(pin),
    // `return` des Versprechens: Die Mutation gilt erst als erfolgreich, wenn
    // die neue Sitzung gelesen ist.
    onSuccess: () => stufeGewechselt(),
  })
}
