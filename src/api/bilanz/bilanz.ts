import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Siege, Niederlagen und Unentschieden des angemeldeten Spielers. */
export type Bilanz = components['schemas']['Bilanz']

/**
 * Liest die eigene Bilanz (`GET /bilanz/lesen`, Stufe `PROFILE_AUTHENTICATED`).
 *
 * Dreimal `0` heißt „nichts zu zeigen“ – bei einem Spieler ohne gewertete Termine
 * wie bei einem Gast, der grundsätzlich keine Bilanz führt. Beide Fälle sind
 * absichtlich nicht unterscheidbar. **Der Auswechselspieler zählt in allen drei
 * Zählern mit.** Wie ein Gast behandelt wird, ist im Vertrag offen (1.4): Die
 * Oberfläche ruft die Bilanz für GAST nicht ab.
 *
 * @param keinRefresh Beim Hintergrundabruf `true`, damit das Sitzungsfenster nicht verlängert wird.
 */
export async function bilanzLesen(keinRefresh = false): Promise<Bilanz> {
  return aufrufen<Bilanz>('GET', '/bilanz/lesen', { keinRefresh })
}
