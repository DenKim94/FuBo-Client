/// <reference lib="webworker" />

/**
 * Service Worker der Anwendung (A25a).
 *
 * In C0 enthaelt er nur das Grundgeruest: Precache der App-Shell, den
 * Navigations-Rueckfall und die Annahme von `SKIP_WAITING`. Die Behandlung der
 * Ereignisse `push` und `notificationclick` (A25b) kommt im Push-Paket dazu.
 *
 * Bewusst gibt es hier **keine** Regel fuer `/api/`: "NetworkOnly" entsteht
 * nicht durch eine Regel, sondern durch das Fehlen jeder Regel – eine Anfrage,
 * auf die der Service Worker nicht antwortet, geht unveraendert ins Netz. Der
 * Cache Storage ist wie `localStorage` von jedem Skript des Origins lesbar und
 * ueberlebt den Logout; eine zwischengespeicherte Admin-Antwort liesse
 * Skillwerte auf dem Geraet zurueck.
 */
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

/** Nachricht, mit der die Oberflaeche die Aktivierung einer neuen Fassung anfordert. */
const NACHRICHT_AKTIVIEREN = 'SKIP_WAITING'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navigationen fallen auf die App-Shell zurueck, Aufrufe unter /api/ nie.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
)

// `registerType: 'prompt'` – der Neuladevorgang bleibt beim Nutzer (A21).
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const daten = event.data as { type?: string } | undefined
  if (daten?.type === NACHRICHT_AKTIVIEREN) {
    void self.skipWaiting()
  }
})
