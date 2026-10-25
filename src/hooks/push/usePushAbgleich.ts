import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { schluessel } from '@/api/common/schluessel'
import { pushAboAnlegen } from '@/api/push/push'
import { useSitzung } from '@/hooks/useSitzung'
import { abonnieren, standLesen } from '@/pwa/pushGeraet'
import { umgebungLesen } from '@/pwa/umgebung'
import { schluesselAbfragen } from './usePushSchluessel'

/**
 * Identität, für die in diesem Seitenaufruf zuletzt abgeglichen wurde (`rolle:anzeigeName`).
 *
 * **Modulvariable statt `useRef`:** `StrictMode` hängt die Wirkung in der Entwicklung ab und wieder an, ein `useRef`
 * überlebte das nicht zuverlässig; eine neue Komponenteninstanz (Neuaufbau des Layouts) ebenso wenig. Ein neuer
 * Seitenaufruf beginnt mit `null` – genau dann soll abgeglichen werden.
 */
let zuletztAbgeglichen: string | null = null

/** Nur für Tests: vergisst den letzten Abgleich. */
export function abgleichZuruecksetzen() {
  zuletztAbgeglichen = null
}

/**
 * Meldet ein vorhandenes Abonnement erneut beim Server an (E29, P3, P7).
 *
 * Nur bei sicherem Ursprung, unterstütztem Push, Berechtigung `granted` **und** vorhandenem Abonnement. Ohne
 * VAPID-Einrichtung (`null`) endet er. Weicht der Schlüssel ab, kündigt `abonnieren` und abonniert neu, ohne Rückfrage
 * (die Berechtigung besteht schon). **Alle Aufrufe mit `X-FuBo-Kein-Refresh`:** Der Abgleich ist keine Bedienung.
 * Fehler bleiben still – der Abgleich ist eine Heilung, keine Funktion, auf die jemand wartet.
 */
export async function abgleichen(queryClient: QueryClient): Promise<void> {
  try {
    const umgebung = umgebungLesen()
    if (!umgebung.sicher || !umgebung.pushMoeglich) return
    const stand = await standLesen()
    if (stand.berechtigung !== 'granted' || stand.abo === null) return
    const vapid = await schluesselAbfragen(true)
    queryClient.setQueryData(schluessel.pushSchluessel, vapid)
    if (vapid === null) return
    const abo = await abonnieren(vapid)
    await pushAboAnlegen(abo, true)
    if (abo.endpoint !== stand.abo.endpoint) await queryClient.invalidateQueries({ queryKey: schluessel.pushGeraet })
  } catch {
    // Still: Ein Fehler hier ändert nichts an der Bedienung; die Einstellungen zeigen den Gerätezustand.
  }
}

/**
 * Start-Abgleich des Push-Abonnements (C9, 6.4): einmal je Identität und Seitenaufruf.
 *
 * Für GAST und ohne abgeschlossene Anmeldung **kein** Aufruf. Nach einem Personenwechsel auf demselben Gerät (andere
 * Identität) läuft er erneut: Der Server übergibt das Abonnement dann der neu angemeldeten Person (P3, E30).
 */
export function usePushAbgleich() {
  const queryClient = useQueryClient()
  const { angemeldet, istGast, sitzung } = useSitzung()
  const identitaet = angemeldet && !istGast && sitzung?.rolle ? `${sitzung.rolle}:${sitzung.anzeigeName ?? ''}` : null

  useEffect(() => {
    if (identitaet === null || identitaet === zuletztAbgeglichen) return
    zuletztAbgeglichen = identitaet
    void abgleichen(queryClient)
  }, [identitaet, queryClient])
}
