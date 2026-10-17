import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { bilanzLesen, type Bilanz } from '@/api/bilanz/bilanz'
import { schluessel } from '@/api/common/schluessel'
import { useSitzung } from '@/hooks/useSitzung'

/**
 * Liest die eigene Bilanz (A21, E19).
 *
 * **Nicht für Gäste:** Ein Gast führt keine Bilanz, und der Vertrag sagt nicht,
 * wie `GET /bilanz/lesen` für ihn antwortet (1.4). Der Hook ruft dann nichts ab
 * (`enabled`), statt einen Fehler zu riskieren. Er wartet außerdem, bis die
 * Sitzung bekannt ist: Ohne Auskunft gälte jeder als „kein Gast“.
 *
 * Abruf mit `X-FuBo-Kein-Refresh: true`: Die Bilanz ändert sich nur durch ein
 * erfasstes Ergebnis (der Hook dazu invalidiert sie), kein Polling.
 *
 * @returns Das Abfrageobjekt; `data` sind die drei Zähler.
 */
export function useBilanz(): UseQueryResult<Bilanz, Error> {
  const { angemeldet, istGast } = useSitzung()
  return useQuery({
    queryKey: schluessel.bilanz,
    queryFn: () => bilanzLesen(true),
    enabled: angemeldet && !istGast,
    staleTime: 60_000,
  })
}
