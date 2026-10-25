import { fehlertextBilden } from '@/api/common/fehler'
import { GeraetFehler } from '@/pwa/pushGeraet'

/**
 * Anzeigetext eines Fehlers beim Einrichten oder Entfernen.
 *
 * Ein {@link GeraetFehler} stammt vom Browser und trägt seinen Text selbst; alles andere läuft wie überall über
 * `fehlertextBilden` (`detail` des Servers, sonst „nicht erreichbar“ oder der Ersatz).
 *
 * @param fehler Fehler der Mutation.
 * @param ersatz Text für Fehler ohne eigenen Text.
 */
export function pushFehlertext(fehler: unknown, ersatz: string): string {
  return fehler instanceof GeraetFehler ? fehler.message : fehlertextBilden(fehler, ersatz)
}
