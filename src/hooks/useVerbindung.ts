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
  // Vor dem ersten Aufruf steht der beobachtete Zustand auf „intakt", und
  // `navigator.onLine` meldet auch im WLAN ohne Weg ins Internet `true`. Die
  // Luecke ist auf den Bruchteil einer Sekunde begrenzt, weil die Ansichten
  // hinter den Guards beim Start die Sitzung lesen (`GET /auth/session/lesen`);
  // dessen Ergebnis – Antwort oder Netzfehler – landet ueber `aufrufen` in
  // diesem Zustand. **Ausnahme:** Die oeffentlichen Routen ohne Guard
  // (`/admin/anmelden`, „nicht gefunden") rufen beim Direkteinstieg nichts auf;
  // dort erscheint der Hinweis erst mit dem ersten Aufruf der Ansicht oder beim
  // Browserereignis `offline`.
  //
  // Ohne dritten Parameter: Er waere nur der Schnappschuss fuer das
  // Server-Rendering, das es in diesem Projekt nicht gibt.
  const verbunden = useSyncExternalStore(abonnieren, lesen)
  return { verbunden }
}
