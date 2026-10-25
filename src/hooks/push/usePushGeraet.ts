import { useQuery } from '@tanstack/react-query'
import { schluessel } from '@/api/common/schluessel'
import { standLesen, type GeraetStand } from '@/pwa/pushGeraet'
import { umgebungLesen, type Umgebung } from '@/pwa/umgebung'

/** Gerätezustand: was der Browser kann und was er über Push weiß. */
export type GeraetDaten = { umgebung: Umgebung; stand: GeraetStand }

/**
 * Der **lokale** Gerätezustand als Abfrage (C9, 3.2).
 *
 * Kein Serveraufruf, deshalb `networkMode: 'always'` (auch ohne Verbindung) und **Neulesen bei Fokus**: Wer in den
 * Browsereinstellungen die Berechtigung ändert und zurückkehrt, sieht sofort den neuen Stand – ohne Serveraufruf und
 * ohne Sitzungsverlängerung. Nach Einrichten und Entfernen genügt `invalidateQueries(pushGeraet)`.
 *
 * @param aktiv Nur für USER und ADMIN.
 */
export function usePushGeraet(aktiv = true) {
  return useQuery<GeraetDaten>({
    queryKey: schluessel.pushGeraet,
    queryFn: async () => ({ umgebung: umgebungLesen(), stand: await standLesen() }),
    enabled: aktiv,
    networkMode: 'always',
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  })
}
