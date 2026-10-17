import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { schluessel } from '@/api/common/schluessel'
import { terminLesen, type TerminDetails } from '@/api/termine/termine'
import { TERMINE_INTERVALL_MS } from '@/hooks/useTermine'

/**
 * Hält einen Termin samt Teilnehmerliste, Teams und Ergebnis aktuell (E6).
 *
 * Gleiches Polling und gleicher Kopf wie {@link useTermine}. **Teams- und
 * Ergebnis-Tab lesen denselben Abruf:** So erscheinen eine fremde Generierung,
 * die Kennzeichnung „veraltet“ und ein fremd erfasstes Ergebnis ohne Neuladen.
 *
 * `terminId` ist `undefined`, solange die Ansicht den Termin noch bestimmt (Hub
 * ohne Parameter) oder die Adresse ungültig ist; dann ruft der Hook nichts ab.
 *
 * @param terminId Technischer Schlüssel des Termins oder `undefined`.
 * @param intervallMs Abstand der Abrufe; nur für Tests abweichend vom Standard.
 */
export function useTermin(
  terminId: number | undefined,
  intervallMs: number = TERMINE_INTERVALL_MS,
): UseQueryResult<TerminDetails, Error> {
  return useQuery({
    queryKey: schluessel.termin(String(terminId ?? '')),
    queryFn: () => terminLesen(terminId as number, true),
    enabled: terminId !== undefined,
    refetchInterval: intervallMs,
    staleTime: 0,
  })
}
