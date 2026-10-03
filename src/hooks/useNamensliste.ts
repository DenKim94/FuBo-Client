import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { namenslisteLesen, type NameOption } from '@/api/auth/auth'
import { schluessel } from '@/api/common/schluessel'

/**
 * Abstand zwischen zwei Abrufen der Namensliste in Millisekunden.
 *
 * Fünf Sekunden: Die Namensauswahl dauert selten länger als eine halbe Minute,
 * und zwei Spieler, die gleichzeitig denselben Namen ansteuern, sollen den
 * Konflikt möglichst sehen, bevor sie absenden. Kürzer brächte kaum Gewinn,
 * aber doppelt so viele Abrufe über das Mobilnetz.
 */
export const NAMENSLISTE_INTERVALL_MS = 5_000

/**
 * Hält die Namensliste samt Belegtstatus aktuell (A4, A6).
 *
 * **Polling statt einmaligem Abruf:** Der Belegtstatus ändert sich, während die
 * Ansicht offen ist – jemand anderes meldet sich unter einem Namen an. Der
 * Kontrakt sieht dafür ausdrücklich Polling vor, keinen Push-Kanal.
 *
 * Jeder Abruf trägt `X-FuBo-Kein-Refresh: true`. Sonst hielte allein das
 * Polling die Sitzung in der Stufe `PIN_VERIFIED` am Leben, solange die Ansicht
 * offen ist. Läuft die Sitzung dabei ab, antwortet der nächste Abruf mit `401
 * SESSION_UNGUELTIG`, und der `SitzungsWaechter` führt zurück zur PIN.
 *
 * Im Hintergrund (Tab verdeckt, Telefon gesperrt) ruht das Polling – das ist
 * die Vorgabe von TanStack Query; beim Zurückkehren wird sofort neu gelesen.
 *
 * @param intervallMs Abstand der Abrufe; nur für Tests abweichend vom Standard.
 * @returns Das Abfrageobjekt; `data` ist die Liste in der Reihenfolge des Servers.
 */
export function useNamensliste(
  intervallMs: number = NAMENSLISTE_INTERVALL_MS,
): UseQueryResult<NameOption[], Error> {
  return useQuery({
    queryKey: schluessel.namensliste,
    queryFn: () => namenslisteLesen(true),
    refetchInterval: intervallMs,
    // Jede Anzeige soll den aktuellen Stand holen; ein Zwischenspeicher von
    // 30 Sekunden (Vorgabe im Query-Client) zeigte belegte Namen als frei.
    staleTime: 0,
  })
}
