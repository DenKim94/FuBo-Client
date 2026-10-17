import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { passwortZuruecksetzen } from '@/api/auth/auth'

/**
 * Fordert die Bestätigungs-PIN für das Zurücksetzen des Passworts an (A22, Schritt 1).
 *
 * Aufgerufen mit `mutate()`. **Kein Stufenwechsel:** Die Sitzung bleibt in
 * `PIN_VERIFIED`, und die Ansicht navigiert selbst zu Schritt 2.
 *
 * **Nur auf ausdrückliche Handlung der Person.** Jede Anforderung entwertet die
 * zuvor offene PIN; ein automatischer Aufruf beim Betreten der Ansicht oder ein
 * Wiederholen im Hintergrund machte eine gerade eingetroffene E-Mail wertlos
 * (die Mutation wiederholt ohnehin nie, siehe `queryClient.ts`).
 *
 * **Fehler:** `RESET_GEDROSSELT` mit `wartesekunden` (höchstens drei je Stunde),
 * `VERSAND_FEHLGESCHLAGEN` (`503`, es bleibt kein Vorgang zurück; der Aufruf
 * lässt sich unverändert wiederholen), `SESSION_UNGUELTIG`.
 */
export function usePasswortAnfordern(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: () => passwortZuruecksetzen(),
  })
}
