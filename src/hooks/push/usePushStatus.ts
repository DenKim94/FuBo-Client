import { useQuery } from '@tanstack/react-query'
import { schluessel } from '@/api/common/schluessel'
import { pushStatusLesen } from '@/api/push/push'

/**
 * Anlagen- und Personenebene (`GET /push/status/lesen`, C9 3.2).
 *
 * Einmal beim Öffnen gelesen (`staleTime: 0`), ohne Polling. **Kein Neulesen bei Fokus oder Wiederverbindung:** Der
 * Abruf trägt keinen `X-FuBo-Kein-Refresh` und verlängert die Sitzung; das darf nur eine Bedienung (AGENT_CLIENT.md).
 *
 * @param aktiv Nur für USER und ADMIN (GAST bekäme `403`, A25d).
 */
export function usePushStatus(aktiv: boolean) {
  return useQuery({
    queryKey: schluessel.pushStatus,
    queryFn: () => pushStatusLesen(),
    enabled: aktiv,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}
