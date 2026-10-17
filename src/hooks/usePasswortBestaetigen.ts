import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { passwortBestaetigen, type PasswortBestaetigung } from '@/api/auth/auth'

/**
 * Löst die Bestätigungs-PIN ein und setzt das neue Admin-Passwort (A22, Schritt 2).
 *
 * Aufgerufen mit `mutate({ bestaetigungsPin, neuesPasswort })`. **Kein
 * Stufenwechsel:** Die aufrufende Sitzung bleibt in `PIN_VERIFIED` und gehört
 * nicht dem Admin (Vertrag). Die Ansicht geht nach dem Erfolg selbst weiter zur
 * Admin-Anmeldung.
 *
 * **Fehler:** `RESET_PIN_FALSCH` (`401`, ein Versuch verbraucht; kein
 * Sitzungsende), `RESET_UNGUELTIG` (`409`: kein brauchbarer Vorgang, neu
 * anfordern statt nochmal versuchen), `PIN_GESPERRT` (`429`),
 * `EINGABE_UNGUELTIG` mit `felder` (`400`, kostet keinen Versuch).
 */
export function usePasswortBestaetigen(): UseMutationResult<void, Error, PasswortBestaetigung> {
  return useMutation({
    mutationFn: (anfrage: PasswortBestaetigung) => passwortBestaetigen(anfrage),
  })
}
