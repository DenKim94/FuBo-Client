import { useSyncExternalStore } from 'react'
import {
  verbindungAbonnieren,
  verbindungGestoert,
  verbindungMelden,
} from '@/api/common/verbindungsStatus'

/**
 * Liest den aktuellen Zustand aus beiden Quellen.
 *
 * Verbunden ist nur, wer beides erfüllt: Der Browser sieht ein Netz **und** der
 * letzte Aufruf hat eine Antwort bekommen.
 */
function lesen(): boolean {
  return navigator.onLine && !verbindungGestoert()
}

/**
 * Verdrahtet die beiden Quellen mit React.
 *
 * Beim Ereignis `online` wird der beobachtete Zustand zurückgesetzt: Sonst
 * bliebe der Hinweis stehen, bis zufällig der nächste Aufruf gelingt. Schlägt
 * der nächste Aufruf erneut fehl, kommt der Hinweis sofort wieder.
 */
function abonnieren(benachrichtigen: () => void): () => void {
  const wiederVerbunden = () => {
    verbindungMelden(true)
    benachrichtigen()
  }

  window.addEventListener('online', wiederVerbunden)
  window.addEventListener('offline', benachrichtigen)
  const abmelden = verbindungAbonnieren(benachrichtigen)

  return () => {
    window.removeEventListener('online', wiederVerbunden)
    window.removeEventListener('offline', benachrichtigen)
    abmelden()
  }
}

/**
 * Meldet, ob die Anwendung den Server erreichen kann.
 *
 * `useSyncExternalStore` statt `useState` mit Effekt: Der Zustand lebt außerhalb
 * von React und ändert sich möglicherweise schon zwischen Rendern und Anmelden
 * des Effekts. Der Hook liest ihn dann erneut, statt einen veralteten Wert
 * anzuzeigen.
 */
export function useVerbindung(): { verbunden: boolean } {
  // Bekannte Optimismus-Luecke (Handoff 6.3): Solange kein Aufruf
  // fehlgeschlagen ist, steht der beobachtete Zustand auf „intakt", und
  // `navigator.onLine` meldet auch im WLAN ohne Weg ins Internet `true` – der
  // Hook sagt dann „verbunden", ohne es zu wissen. Den Gegenbeweis liefert
  // erst ein Aufruf, und `/anmelden` loest bis C3 keinen aus. Der dritte
  // Parameter ist nur der Serverschnappschuss (kein SSR im Projekt).
  const verbunden = useSyncExternalStore(abonnieren, lesen, () => true)
  return { verbunden }
}
