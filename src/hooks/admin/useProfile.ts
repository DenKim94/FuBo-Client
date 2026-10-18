import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { profileLesen, type SpielerDetails } from '@/api/admin/adminProfile'
import { schluessel } from '@/api/common/schluessel'

/**
 * Liest alle Profile samt Skillwerten (A12, nur ADMIN).
 *
 * **Lesen im Admin ohne Polling und ohne `X-FuBo-Kein-Refresh`** (E4): Eine Liste, in der
 * der Admin arbeitet, ändert sich nicht unter seinen Händen, und das Öffnen der Seite ist
 * Bedienung, die die Sitzung verlängern darf. `refetchOnWindowFocus: false`, damit ein
 * Wechsel zwischen Fenstern kein Formular unter dem Admin neu aufbaut.
 *
 * Jede Mutation der Profile liest diese Abfrage neu (`useProfilAnlegen` und Verwandte).
 */
export function useProfile(): UseQueryResult<SpielerDetails[], Error> {
  return useQuery({
    queryKey: schluessel.adminProfile,
    queryFn: profileLesen,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: 0,
  })
}
