import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { zentralePinAendern, type PinAenderung } from '@/api/admin/admin'
import { sitzungsendeAusloesen } from '@/app/queryClient'

/** Hinweis auf der PIN-Eingabe, nachdem die Änderung alle Sitzungen beendet hat (E19). */
export const HINWEIS_PIN_GEAENDERT = 'Die zentrale PIN wurde geändert. Bitte melde dich mit der neuen PIN an.'

/**
 * Ändert die zentrale PIN (A3, E19).
 *
 * Aufgerufen mit `mutate({ neuePin })`.
 *
 * **Nach dem Erfolg räumt der Client sofort auf** (`sitzungsendeAusloesen` mit
 * Hinweis): Der Server hat **alle** Sitzungen widerrufen, auch die des Admins.
 * Ohne das stünde die Verwaltung bis zum nächsten Frist-Abruf mit einer Sitzung
 * da, die es nicht mehr gibt.
 *
 * **Der Rückruf liegt im Hook, nicht im `mutate`-Aufruf:** Die Seite wird beim
 * Sitzungsende ausgehängt, und `mutate(…, { onSuccess })` verliert seine Rückrufe,
 * wenn der Aufrufer nicht mehr eingehängt ist (C5-Falle).
 *
 * Liest nach dem Erfolg **nichts** neu – der Cache wird geleert.
 */
export function usePinAendern(): UseMutationResult<void, Error, PinAenderung> {
  return useMutation({
    mutationFn: (anfrage: PinAenderung) => zentralePinAendern(anfrage),
    onSuccess: () => sitzungsendeAusloesen(HINWEIS_PIN_GEAENDERT),
  })
}
