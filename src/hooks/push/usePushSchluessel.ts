import { useQuery } from '@tanstack/react-query'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { pushSchluesselLesen } from '@/api/push/push'

/**
 * Liest den VAPID-Schlüssel und übersetzt `503 PUSH_NICHT_KONFIGURIERT` in `null` (P2).
 *
 * **`null` ist eine Auskunft, kein Fehler:** „gibt es auf diesem Server nicht“. Als Datum statt als Fehler gespeichert,
 * fragt keine weitere Ansicht (Einstellungen, Onboarding, Start-Abgleich) in dieser Sitzung noch einmal nach – ein
 * gespeicherter Fehler würde beim nächsten Einhängen erneut gelesen.
 *
 * @param keinRefresh Für den Start-Abgleich (E29), der keine Bedienung ist.
 * @returns Der Schlüssel oder `null` ohne VAPID-Einrichtung.
 */
export async function schluesselAbfragen(keinRefresh = false): Promise<string | null> {
  try {
    return (await pushSchluesselLesen(keinRefresh)).vapidPublicKey
  } catch (fehler) {
    if (fehler instanceof ApiFehler && fehler.status === 503 && fehler.code === 'PUSH_NICHT_KONFIGURIERT') return null
    throw fehler
  }
}

/** Rückgabe von {@link usePushSchluessel}. */
export type PushSchluesselZustand = {
  /** `true` mit Schlüssel, `false` ohne VAPID-Einrichtung, `undefined` solange unbekannt (lädt oder Fehler). */
  verfuegbar: boolean | undefined
  /** Der Schlüssel, falls verfügbar. */
  vapid: string | undefined
  laedt: boolean
  fehler: Error | null
  erneut: () => void
}

/**
 * Der VAPID-Schlüssel für die Einstellungen und das Onboarding (C9, 3.2).
 *
 * **Ohne Wiederholung** (`retry: false`): Der `queryClient` wiederholt `5xx` sonst einmal. `staleTime: Infinity`, weil
 * der Schlüssel sich nur durch einen Eingriff des Betreibers ändert; den Wechsel erkennt der Start-Abgleich beim
 * nächsten Laden. Kein Neulesen bei Fokus oder Wiederverbindung: Jeder Abruf ohne `X-FuBo-Kein-Refresh` verlängert
 * die Sitzung und darf nur aus einer Bedienung kommen.
 *
 * @param aktiv Nur für USER und ADMIN (GAST bekäme `403`, A25d).
 */
export function usePushSchluessel(aktiv: boolean): PushSchluesselZustand {
  const abfrage = useQuery({
    queryKey: schluessel.pushSchluessel,
    queryFn: () => schluesselAbfragen(),
    enabled: aktiv,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const daten = abfrage.data
  return {
    verfuegbar: daten === undefined ? undefined : daten !== null,
    vapid: daten ?? undefined,
    laedt: aktiv && abfrage.isPending,
    fehler: abfrage.error,
    erneut: () => void abfrage.refetch(),
  }
}
