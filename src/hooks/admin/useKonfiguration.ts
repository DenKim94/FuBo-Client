import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { konfigurationLesen, type Konfiguration } from '@/api/admin/adminKonfiguration'
import { schluessel } from '@/api/common/schluessel'

/**
 * Liest die anwendungsweite Konfiguration (A3/A10/A11/A15/A17/A23/A25, nur ADMIN).
 *
 * **Lesen im Admin ohne Polling und ohne `X-FuBo-Kein-Refresh`** (C7 E4): Das Öffnen der Seite ist eine Bedienung und
 * darf die Sitzung verlängern; ein Formular, das beim Fensterwechsel neu lädt, überschriebe Eingaben
 * (`refetchOnWindowFocus: false`).
 *
 * **`gcTime: 0`:** Jeder Besuch lädt frisch. Ein Stand aus dem letzten Besuch setzte das Formular erst auf alte Werte
 * und baute es beim Eintreffen des neuen mit `key={version}` neu auf – die ersten Eingaben gingen verloren (E5).
 *
 * Gelesen wird auch von der Hallenabsage (`hallenModusAktiv`, `halleEmail`) und der manuellen Generierung
 * (`minTeilnehmer`, `maxTeilnehmer`, Verfahren, Regel).
 */
export function useKonfiguration(): UseQueryResult<Konfiguration, Error> {
  return useQuery({
    queryKey: schluessel.adminKonfiguration,
    queryFn: konfigurationLesen,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: 0,
    gcTime: 0,
  })
}
