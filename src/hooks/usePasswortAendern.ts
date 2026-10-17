import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { passwortAendern, type PasswortAenderung } from '@/api/admin/admin'
import { sitzungsendeAusloesen } from '@/app/queryClient'

/** Hinweis auf der PIN-Eingabe, nachdem der Wechsel die Sitzung beendet hat (E4). */
export const HINWEIS_PASSWORT_GEAENDERT =
  'Passwort geändert. Bitte melde dich mit dem neuen Passwort an.'

/**
 * Ändert das Admin-Passwort im angemeldeten Zustand (A22).
 *
 * Aufgerufen mit `mutate({ altesPasswort, neuesPasswort })`.
 *
 * **Nach dem Erfolg räumt der Client sofort auf** (`sitzungsendeAusloesen` mit
 * Hinweis, derselbe Weg wie beim Ablauf): Der Server hat alle Adminsitzungen
 * widerrufen und das Cookie gelöscht. Ohne das stünde die Admin-Ansicht bis zum
 * nächsten Frist-Abruf (bis zu 30 Sekunden) mit einer Sitzung da, die es nicht
 * mehr gibt, und der Cache hielte Admin-Daten. Der Hinweis erscheint neutral auf
 * der PIN-Eingabe.
 *
 * **Ein falsches bisheriges Passwort beendet die Sitzung nicht:**
 * `ADMIN_PASSWORT_FALSCH` ist ein Eingabefehler mitten in einer gültigen Sitzung
 * (`istSitzungsende` unterscheidet über `code`), und `onSuccess` läuft dann nicht.
 * Weitere Fehler: `PIN_GESPERRT` (`429`, ein falsches altes Passwort zählt auf
 * den Brute-Force-Zähler), `EINGABE_UNGUELTIG` mit `felder`, `SESSION_UNGUELTIG`.
 */
export function usePasswortAendern(): UseMutationResult<void, Error, PasswortAenderung> {
  return useMutation({
    mutationFn: (anfrage: PasswortAenderung) => passwortAendern(anfrage),
    onSuccess: () => sitzungsendeAusloesen(HINWEIS_PASSWORT_GEAENDERT),
  })
}
