import type { Page, Route } from '@playwright/test'

/**
 * Nachbildung der Push-Endpunkte und der Push-API des Browsers fuer die E2E-Tests (C9, 3.4).
 *
 * **Warum eine Attrappe im Browser:** Ein echtes `subscribe()` scheitert in Headless-Chromium mangels Push-Dienst.
 * `pushGeraetNachbilden` ersetzt deshalb per `addInitScript` `Notification.permission`/`requestPermission`,
 * `PushManager.prototype.subscribe`/`getSubscription` und liefert ein Abonnement mit `unsubscribe()`. Der echte
 * Service Worker der gebauten Fassung bleibt registriert; `serviceWorker.ready` loest also wie im Betrieb auf.
 */

/** Beispielschluessel aus dem Vertrag (87 Zeichen, base64url ohne Polsterung). */
export const E2E_VAPID = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'

/** Zustand des nachgebildeten Servers. */
export type PushServer = {
  eingerichtet: boolean
  anlageAktiv: boolean
  pushErwuenscht: boolean
  endpunkte: Set<string>
  /** Reihenfolge der Aufrufe mit `X-FuBo-Kein-Refresh` je Aufruf. */
  aufrufe: { pfad: string; keinRefresh: string | undefined }[]
  /** Gesendete Koerper von `abo/anlegen`. */
  angelegt: { endpoint: string; p256dh: string; auth: string }[]
  /** Gesendete Endpoint-Adressen von `abo/entfernen`. */
  entfernt: string[]
  /** `Content-Type` und Koerper des Probeversands. */
  probe: { inhaltstyp: string | undefined; koerper: string | null }[]
}

function problem(route: Route, status: number, code: string, detail: string) {
  return route.fulfill({
    status,
    contentType: 'application/problem+json',
    json: { type: 'about:blank', status, code, detail },
  })
}

/** Bildet die sechs Push-Endpunkte nach. Spaeter angemeldete Routen gewinnen (Playwright). */
export async function pushNachbilden(page: Page, anfang: Partial<PushServer> = {}): Promise<PushServer> {
  const server: PushServer = {
    eingerichtet: true,
    anlageAktiv: true,
    pushErwuenscht: true,
    endpunkte: new Set(),
    aufrufe: [],
    angelegt: [],
    entfernt: [],
    probe: [],
    ...anfang,
  }
  const merken = (route: Route, pfad: string) =>
    server.aufrufe.push({ pfad, keinRefresh: route.request().headers()['x-fubo-kein-refresh'] })

  await page.route('**/api/v1/push/schluessel/lesen', (route) => {
    merken(route, 'schluessel')
    if (!server.eingerichtet) {
      return problem(route, 503, 'PUSH_NICHT_KONFIGURIERT', 'Push-Benachrichtigungen sind auf diesem Server nicht eingerichtet.')
    }
    return route.fulfill({ json: { vapidPublicKey: E2E_VAPID } })
  })
  await page.route('**/api/v1/push/status/lesen', (route) => {
    merken(route, 'status')
    return route.fulfill({ json: { anlageAktiv: server.anlageAktiv, pushErwuenscht: server.pushErwuenscht } })
  })
  await page.route('**/api/v1/push/einstellung/aendern', (route) => {
    merken(route, 'einstellung')
    server.pushErwuenscht = (route.request().postDataJSON() as { pushErwuenscht: boolean }).pushErwuenscht
    return route.fulfill({ json: { pushErwuenscht: server.pushErwuenscht } })
  })
  await page.route('**/api/v1/push/abo/anlegen', (route) => {
    merken(route, 'anlegen')
    const koerper = route.request().postDataJSON() as PushServer['angelegt'][number]
    server.angelegt.push(koerper)
    server.endpunkte.add(koerper.endpoint)
    return route.fulfill({ json: { aboVorhanden: true } })
  })
  await page.route('**/api/v1/push/abo/entfernen', (route) => {
    merken(route, 'entfernen')
    const { endpoint } = route.request().postDataJSON() as { endpoint: string }
    server.entfernt.push(endpoint)
    server.endpunkte.delete(endpoint)
    return route.fulfill({ json: { aboVorhanden: false } })
  })
  await page.route('**/api/v1/admin/push/test', (route) => {
    merken(route, 'probe')
    server.probe.push({ inhaltstyp: route.request().headers()['content-type'], koerper: route.request().postData() })
    if (!server.eingerichtet) {
      return problem(route, 503, 'PUSH_NICHT_KONFIGURIERT', 'Push-Benachrichtigungen sind auf diesem Server nicht eingerichtet.')
    }
    return route.fulfill({ json: { empfaenger: server.endpunkte.size, zugestellt: server.endpunkte.size } })
  })
  return server
}

/** Anfangszustand des nachgebildeten Geraets. */
export type GeraetAnfang = {
  berechtigung?: 'default' | 'granted' | 'denied'
  /** Ergebnis von `requestPermission`. */
  antwort?: 'default' | 'granted' | 'denied'
  /** Ein vorhandenes Abonnement (Endpoint-Adresse) mit dem Schluessel {@link E2E_VAPID}. */
  abonnement?: string | null
}

/** Was die Attrappe im Browser protokolliert (`window.__pushGeraet`). */
export type GeraetProtokoll = { aufrufe: string[]; abo: string | null; berechtigung: string }

/**
 * Ersetzt die Push-API des Browsers vor jedem Laden der Seite.
 *
 * Das Protokoll liegt unter `window.__pushGeraet` und ist mit {@link geraetProtokoll} lesbar. Ein Neuladen beginnt mit
 * dem Anfangszustand (das Init-Skript laeuft erneut) – fuer den Start-Abgleich genau richtig.
 */
export async function pushGeraetNachbilden(page: Page, anfang: GeraetAnfang = {}) {
  await page.addInitScript(
    ({ berechtigung, antwort, abonnement, vapid }) => {
      // WebKit-Projekte (abgeschaltet) kennen `PushManager` ausserhalb einer abgelegten App nicht: dort nichts ersetzen.
      if (typeof PushManager === 'undefined' || typeof Notification === 'undefined') return
      const zustand = { aufrufe: [] as string[], abo: abonnement as string | null, berechtigung }
      ;(window as unknown as { __pushGeraet: typeof zustand }).__pushGeraet = zustand

      const roh = atob(vapid.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(vapid.length / 4) * 4, '='))
      const vapidBytes = Uint8Array.from(roh, (z) => z.charCodeAt(0))
      let schluessel: ArrayBuffer | null = abonnement ? vapidBytes.slice().buffer : null

      const aboObjekt = () =>
        zustand.abo === null
          ? null
          : {
              endpoint: zustand.abo,
              options: { applicationServerKey: schluessel, userVisibleOnly: true },
              toJSON: () => ({
                endpoint: zustand.abo,
                keys: { p256dh: 'B'.padEnd(88, 'x'), auth: 'a'.repeat(22) },
              }),
              unsubscribe: async () => {
                zustand.aufrufe.push('kuendigen')
                zustand.abo = null
                schluessel = null
                return true
              },
            }

      Object.defineProperty(Notification, 'permission', { configurable: true, get: () => zustand.berechtigung })
      Notification.requestPermission = (async () => {
        zustand.aufrufe.push('erfragen')
        zustand.berechtigung = antwort
        return antwort
      }) as typeof Notification.requestPermission

      PushManager.prototype.getSubscription = async function () {
        return aboObjekt() as unknown as PushSubscription
      }
      PushManager.prototype.subscribe = async function (optionen?: PushSubscriptionOptionsInit) {
        zustand.aufrufe.push('abonnieren')
        if (zustand.berechtigung !== 'granted') throw new DOMException('nicht erlaubt', 'NotAllowedError')
        const neu = new Uint8Array(optionen?.applicationServerKey as Uint8Array)
        schluessel = neu.slice().buffer
        if (zustand.abo === null) zustand.abo = 'https://push.example/E2E-Geraet_1'
        return aboObjekt() as unknown as PushSubscription
      }
    },
    {
      berechtigung: anfang.berechtigung ?? 'default',
      antwort: anfang.antwort ?? 'granted',
      abonnement: anfang.abonnement ?? null,
      vapid: E2E_VAPID,
    },
  )
}

/** Liest das Protokoll der Attrappe. */
export function geraetProtokoll(page: Page): Promise<GeraetProtokoll> {
  return page.evaluate(() => (window as unknown as { __pushGeraet: GeraetProtokoll }).__pushGeraet)
}
