import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { adminAnmelden, type AdminAnmeldung } from '@/api/auth/auth'
import { useSitzungswechsel } from '@/hooks/useSitzungswechsel'

/**
 * Führt die zweite Stufe des Logins für den Admin aus: Anmeldename und Passwort (A22).
 *
 * Aufgerufen mit `mutate({ anmeldename, passwort })`. Ein Stufenwechsel wie bei
 * PIN-Prüfung, Namenswahl und Gastanmeldung: **Nach dem Erfolg** läuft der
 * gemeinsame Aufräumschritt (`useSitzungswechsel`), und `isSuccess` wird erst
 * gesetzt, wenn `useSitzung` die Rolle `ADMIN` kennt. Dann leitet der Guard
 * (`LoginSchrittRoute`, Ziel nach `zielFuerStufe`) zum Admin-Dashboard – die
 * Ansicht navigiert nicht selbst.
 *
 * **Fehler** kommen als `ApiFehler`: `ADMIN_PASSWORT_FALSCH` (Name und Passwort
 * sind nicht unterscheidbar), `PIN_GESPERRT` mit `wartesekunden` (derselbe
 * Zähler wie an der PIN), `EINGABE_UNGUELTIG` mit `felder`, `SESSION_UNGUELTIG`.
 * Nur das letzte beendet die Sitzung (`istSitzungsende` in `queryClient.ts`);
 * ein falsches Passwort ist ein Eingabefehler. Ein zweiter Versuch findet nicht
 * automatisch statt – er verlängerte bei `429` die Sperre.
 */
export function useAdminAnmelden(): UseMutationResult<void, Error, AdminAnmeldung> {
  const stufeGewechselt = useSitzungswechsel()

  return useMutation({
    mutationFn: (anfrage: AdminAnmeldung) => adminAnmelden(anfrage),
    onSuccess: () => stufeGewechselt(),
  })
}
