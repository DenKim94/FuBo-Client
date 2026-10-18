import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { adminNameBestaetigen, type NameBestaetigung } from '@/api/admin/admin'

/**
 * Löst die Bestätigungs-PIN der Namensänderung ein (E20, Schritt 2).
 *
 * Aufgerufen mit `mutateAsync({ bestaetigungsPin })`. **Kein Sitzungsende und kein
 * Neulesen:** Die Sitzung bleibt bestehen, der neue Name gilt erst bei der nächsten
 * Anmeldung. Die Ansicht geht danach mit Hinweis zum Dashboard.
 *
 * **`401 NAME_PIN_FALSCH` ist ein Eingabefehler**, kein Sitzungsende: Der globale
 * Weg (`istSitzungsende`) verzweigt über `code` und beendet nur bei
 * `SESSION_UNGUELTIG`. Weitere Fehler: `NAME_AENDERUNG_UNGUELTIG` (`409`: neu
 * anfordern statt nochmal versuchen), `NAME_BELEGT` (`409`, auch jetzt noch),
 * `PIN_GESPERRT` (`429` mit `wartesekunden`), `EINGABE_UNGUELTIG`.
 */
export function useNameBestaetigen(): UseMutationResult<void, Error, NameBestaetigung> {
  return useMutation({
    mutationFn: (anfrage: NameBestaetigung) => adminNameBestaetigen(anfrage),
  })
}
