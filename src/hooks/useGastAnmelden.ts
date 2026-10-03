import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { alsGastAnmelden, type GastStufe } from '@/api/auth/auth'
import { useSitzungswechsel } from '@/hooks/useSitzungswechsel'

/** Angaben einer Gastanmeldung. */
export type GastAngaben = {
  /** Temporärer Anzeigename, ohne den Zusatz „(Gast)". */
  gastName: string
  /** Selbsteinschätzung; ohne Angabe gilt serverseitig `MITTEL`. */
  stufe?: GastStufe
}

/**
 * Zweite Stufe des Logins für Gäste (A8, A17).
 *
 * Aufgerufen mit `mutate({ gastName, stufe })`. Nach dem Erfolg läuft der
 * gemeinsame Stufenwechsel wie bei der Namensauswahl; die Rolle ist dann GAST.
 *
 * Fehler als `ApiFehler`: `NAME_BELEGT` gehört an das Namensfeld (die
 * Oberfläche weiss, welches Feld gemeint ist), `KEIN_GAST_SLOT_FREI` und
 * `EINGABE_UNGUELTIG` in den Fehlerkasten der Ansicht.
 *
 * @returns Das Mutationsobjekt; die Variable sind die Gastangaben.
 */
export function useGastAnmelden(): UseMutationResult<void, Error, GastAngaben> {
  const stufeGewechselt = useSitzungswechsel()

  return useMutation({
    mutationFn: ({ gastName, stufe }: GastAngaben) => alsGastAnmelden(gastName, stufe),
    onSuccess: () => stufeGewechselt(),
  })
}
