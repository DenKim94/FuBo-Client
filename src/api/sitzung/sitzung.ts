import { ApiFehler } from '@/api/common/fehler'
import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Zustand der eigenen Sitzung, wie der Server ihn meldet. */
export type SitzungInfo = components['schemas']['SitzungInfo']

/** Stufe des zweistufigen Logins. Wird serverseitig erzwungen. */
export type Stage = components['schemas']['Stage']

/** Rolle der angemeldeten Identität. In der Stufe `PIN_VERIFIED` noch nicht gesetzt. */
export type Rolle = components['schemas']['Rolle']

/**
 * Liest die laufende Sitzung.
 *
 * Gibt bei `401` bewusst `null` zurück statt zu werfen: „keine Sitzung" ist der
 * Normalzustand eines nicht angemeldeten Besuchers und kein Fehlerfall.
 *
 * **Zugleich darf dieser eine Aufruf die globale Abmeldung nicht auslösen.**
 * Täte er es, liefe der Startaufruf jedes nicht angemeldeten Besuchers in die
 * Behandlung aus `queryClient.ts`, die auf `/anmelden` umleitet – wo derselbe
 * Aufruf wieder stattfindet. Der `401` wird deshalb hier abgefangen, bevor er
 * den Query-Cache erreicht.
 *
 * @param keinRefresh Bei zyklischen Abrufen `true` setzen (Countdown ab C3),
 *   damit das gleitende Sitzungsfenster nicht durch die Abfrage selbst
 *   verlängert wird.
 */
export async function sitzungLesen(keinRefresh = false): Promise<SitzungInfo | null> {
  try {
    return await aufrufen<SitzungInfo>('GET', '/auth/session/lesen', { keinRefresh })
  } catch (fehler) {
    if (fehler instanceof ApiFehler && fehler.status === 401) return null
    throw fehler
  }
}
