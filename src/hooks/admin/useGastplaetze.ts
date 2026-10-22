import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { gastplaetzeLesen, type GastPlatzInfo } from '@/api/admin/adminKonfiguration'
import { schluessel } from '@/api/common/schluessel'

/**
 * Liest alle Gastplätze samt Zustand (A17, nur ADMIN), auch die unwirksamen.
 *
 * Ohne Polling und ohne `X-FuBo-Kein-Refresh` (C7 E4). Der Zustand ändert sich ohne Zutun des Admins (Sitzungen
 * laufen ab); die Seite bietet dafür „Aktualisieren“ an, statt zu pollen.
 *
 * @param aktiv `false` schiebt den Abruf auf: Der Dialog der Gast-Stufe lädt die Plätze erst, wenn er offen ist.
 */
export function useGastplaetze(aktiv = true): UseQueryResult<GastPlatzInfo[], Error> {
  return useQuery({
    queryKey: schluessel.adminGaeste,
    queryFn: gastplaetzeLesen,
    enabled: aktiv,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: 0,
  })
}
