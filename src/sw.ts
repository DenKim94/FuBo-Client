/// <reference lib="webworker" />

/**
 * Service Worker der Anwendung (A25a).
 *
 * Grundgeruest aus C0: Precache der App-Shell, der Navigations-Rueckfall und die
 * Annahme von `SKIP_WAITING`. Seit C9 dazu die Ereignisse `push` und
 * `notificationclick` (A25b, E31); der Inhalt der Benachrichtigung entsteht in
 * `pwa/benachrichtigung.ts`, damit er ohne Worker testbar ist.
 *
 * **Kein `fetch` und kein API-Aufruf** im Worker (P10): Zur Versandzeit ist die
 * Sitzung abgelaufen. **Kein `pushsubscriptionchange`:** Ein erneuertes
 * Abonnement meldet der Start-Abgleich der Seite an; der Worker haette dafuer
 * keine Sitzung.
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
import { NACHRICHT_NAVIGIEREN, benachrichtigungBauen, zielPfad, type Nutzlast } from './pwa/benachrichtigung'

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

/** `renotify` fehlt in `NotificationOptions` der TypeScript-Bibliothek (TS2353); lokal ergaenzt statt `as any`. */
type BenachrichtigungOptionen = NotificationOptions & { renotify?: boolean }

/** Liest die Nutzlast; kein JSON oder keine Daten ergeben `null` (Rueckfall in `benachrichtigungBauen`). */
function nutzlastLesen(event: PushEvent): Nutzlast | null {
  try {
    return (event.data?.json() as Nutzlast | undefined) ?? null
  } catch {
    return null
  }
}

// Immer eine Benachrichtigung zeigen: `userVisibleOnly: true` ist eine Zusage. Ohne Anzeige blendet Chrome eine
// eigene Meldung ein und kann das Abonnement einschraenken – deshalb kein fruehes `return`, auch nicht bei
// kaputter Nutzlast (E31).
self.addEventListener('push', (event: PushEvent) => {
  const anzeige = benachrichtigungBauen(nutzlastLesen(event))
  const optionen: BenachrichtigungOptionen = {
    body: anzeige.text,
    tag: anzeige.tag,
    // `renotify` ohne `tag` wirft in Chrome einen TypeError; nur mit `tag` setzen.
    renotify: anzeige.tag ? anzeige.renotify : undefined,
    lang: 'de',
    icon: '/icons/pwa/app-icon-192.png',
    data: { url: anzeige.url },
  }
  event.waitUntil(self.registration.showNotification(anzeige.titel, optionen))
})

// Antippen: ein offenes Fenster der Anwendung fokussieren und dort navigieren (ohne Neuladen), sonst ein neues
// oeffnen. Nur Pfade des eigenen Ursprungs (`zielPfad`).
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const ziel = zielPfad((event.notification.data as { url?: unknown } | null)?.url)
  event.waitUntil(
    (async () => {
      const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const offen = fenster.find((f) => new URL(f.url).origin === self.location.origin)
      if (offen) {
        await offen.focus()
        offen.postMessage({ type: NACHRICHT_NAVIGIEREN, url: ziel })
        return
      }
      await self.clients.openWindow(ziel)
    })(),
  )
})
