import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { schluessel } from '@/api/common/schluessel'
import { termineLesen, type TerminUebersicht } from '@/api/termine/termine'
import { heuteIso } from '@/api/termine/terminZeit'

/**
 * Abstand zwischen zwei Abrufen der Termine in Millisekunden (E6).
 *
 * Zwanzig Sekunden: Zusagen und Nachrücken anderer sollen ohne Neuladen
 * erscheinen, sind aber weniger dringend als ein Namenskonflikt (5 s), und die
 * Antworten sind klein.
 */
export const TERMINE_INTERVALL_MS = 20_000

/**
 * Hält die Terminliste aktuell (A7, A9).
 *
 * **Polling mit `X-FuBo-Kein-Refresh: true`:** Es hält die Sitzung nicht offen.
 * Als Aktivität zählen weiter die Navigation (`useSitzung`) und die Rückmeldung
 * selbst. Ohne den Kopf verlängerte allein die offene Ansicht die Sitzung, und
 * der Ablauf-Dialog käme nie (Falle aus C3).
 *
 * **Stichtag heute (`ab`):** Seit der Vertragsänderung vom 18.10.2026 liefert
 * `GET /termine/lesen` ohne `ab` **alle** Termine, auch vergangene. Das Dashboard
 * will nur heutige und kommende; ohne `ab` füllte sich `abgesagtDavor` (siehe
 * `naechsterTermin`) mit allen alten Absagen. Der Stichtag wird je Abruf in
 * `queryFn` gebildet, nicht im Render – so wandert er über Mitternacht mit.
 *
 * @param intervallMs Abstand der Abrufe; nur für Tests abweichend vom Standard.
 * @returns Das Abfrageobjekt; `data` ist die Liste in der Reihenfolge des Servers.
 */
export function useTermine(
  intervallMs: number = TERMINE_INTERVALL_MS,
): UseQueryResult<TerminUebersicht[], Error> {
  return useQuery({
    queryKey: schluessel.termine,
    queryFn: () => termineLesen({ ab: heuteIso(new Date()), keinRefresh: true }),
    refetchInterval: intervallMs,
    // Jede Anzeige soll den aktuellen Stand holen, nicht den von vor 30 Sekunden.
    staleTime: 0,
  })
}
