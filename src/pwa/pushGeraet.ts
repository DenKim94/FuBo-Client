import type { AboAnlegen } from '@/api/push/push'
import { NACHRICHT_NAVIGIEREN, zielPfad } from './benachrichtigung'

/**
 * Adapter zur Push-API des Browsers (C9, 4.2).
 *
 * **Die einzige Datei, die `Notification`, `pushManager` und `navigator.serviceWorker` anfasst** (Abnahme 1 prüft das;
 * die Registrierung des Workers selbst bleibt bei `useRegisterSW` im `AktualisierungsHinweis`). Seiten
 * und Hooks kennen nur diese Funktionen; Tests ersetzen das Modul (`src/test/pushGeraetAttrappe.ts`), weil jsdom
 * weder `Notification` noch `PushManager` noch `navigator.serviceWorker` kennt.
 */

/** Stand der Berechtigung im Browser. `denied` ist für die Seite endgültig: Ein zweiter Dialog ist nicht möglich. */
export type Berechtigung = 'default' | 'granted' | 'denied'

/** Was der Browser über Push auf diesem Gerät weiß. */
export type GeraetStand = {
  berechtigung: Berechtigung
  /** Vorhandenes Abonnement samt dem Schlüssel, mit dem es angelegt wurde; `null` ohne Abonnement. */
  abo: { endpoint: string; schluessel: Uint8Array | null } | null
}

/** Art eines Fehlers, der nicht vom Server stammt. */
export type GeraetFehlerArt = 'abgelehnt' | 'geschlossen' | 'nichtBereit' | 'browser'

/**
 * Fehler des Browsers beim Einrichten oder Entfernen.
 *
 * Eigene Klasse, damit die Oberfläche ihn vom Netzfehler unterscheidet: Ein `TypeError` aus der Push-API zeigte
 * sonst „Der Server ist nicht erreichbar“ (`istNetzfehler` prüft auf `TypeError`). Der Text ist für die Anzeige.
 */
export class GeraetFehler extends Error {
  readonly art: GeraetFehlerArt
  constructor(art: GeraetFehlerArt, text: string) {
    super(text)
    this.name = 'GeraetFehler'
    this.art = art
  }
}

/** Wartezeit auf einen aktiven Service Worker beim Einrichten. */
export const BEREIT_FRIST_MS = 10_000

/**
 * base64url (mit oder ohne Polsterung) in Bytes, für `applicationServerKey`.
 *
 * @param wert Der Schlüssel des Servers, z. B. 87 Zeichen ohne Polsterung.
 */
export function base64urlZuBytes(wert: string): Uint8Array<ArrayBuffer> {
  const b64 = wert.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '')
  const gepolstert = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
  return Uint8Array.from(atob(gepolstert), (zeichen) => zeichen.charCodeAt(0))
}

/** Vergleicht zwei Schlüssel Byte für Byte; ein fehlender Schlüssel ist nie gleich. */
export function gleicheBytes(a: Uint8Array | null, b: Uint8Array): boolean {
  return a !== null && a.length === b.length && a.every((wert, i) => wert === b[i])
}

/** Der Service-Worker-Container oder `null`, wenn der Browser keinen kennt (oder kein sicherer Ursprung). */
function container(): ServiceWorkerContainer | null {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : null
}

/** Berechtigung ohne Dialog; ohne `Notification` gilt `default`. */
function berechtigungLesen(): Berechtigung {
  return typeof Notification === 'undefined' ? 'default' : (Notification.permission as Berechtigung)
}

/**
 * Wartet auf einen **aktiven** Service Worker.
 *
 * `serviceWorker.ready` löst ohne registrierten Worker nie auf (`npm run dev` ohne `dev:pwa`, Firefox im privaten
 * Modus) – deshalb mit Zeitlimit und verständlichem Fehler statt ewigem Laden.
 */
async function bereiteRegistrierung(ms = BEREIT_FRIST_MS): Promise<ServiceWorkerRegistration> {
  const sw = container()
  if (!sw) throw new GeraetFehler('nichtBereit', 'Dieser Browser unterstützt keine Benachrichtigungen.')
  let zeitgeber: ReturnType<typeof setTimeout> | undefined
  const frist = new Promise<never>((_, ablehnen) => {
    zeitgeber = setTimeout(
      () =>
        ablehnen(
          new GeraetFehler(
            'nichtBereit',
            'Die App ist auf diesem Gerät noch nicht bereit. Lade die Seite neu und versuche es erneut.',
          ),
        ),
      ms,
    )
  })
  try {
    return await Promise.race([sw.ready, frist])
  } finally {
    clearTimeout(zeitgeber)
  }
}

/** Das vorhandene Abonnement, ohne auf einen aktiven Worker zu warten (`getRegistration` hängt nie). */
async function vorhandenesAbo(): Promise<PushSubscription | null> {
  const sw = container()
  if (!sw || typeof PushManager === 'undefined') return null
  const registrierung = await sw.getRegistration()
  return (await registrierung?.pushManager.getSubscription()) ?? null
}

/** Schlüssel, mit dem ein Abonnement angelegt wurde. */
function schluesselVon(abo: PushSubscription): Uint8Array | null {
  const roh = abo.options?.applicationServerKey
  return roh ? new Uint8Array(roh) : null
}

/**
 * Liest Berechtigung und vorhandenes Abonnement. Ändert nichts, fragt nichts, ruft kein Netz.
 */
export async function standLesen(): Promise<GeraetStand> {
  const berechtigung = berechtigungLesen()
  const abo = await vorhandenesAbo()
  return { berechtigung, abo: abo ? { endpoint: abo.endpoint, schluessel: schluesselVon(abo) } : null }
}

/**
 * Fragt die Berechtigung an.
 *
 * **Muss synchron aus dem Klick heraus beginnen** (E26): kein `await` davor. Safari verliert die Nutzergeste nach
 * einem Netzaufruf, die Anfrage scheiterte dann ohne Dialog.
 */
export function berechtigungErfragen(): Promise<Berechtigung> {
  if (typeof Notification === 'undefined') return Promise.resolve('denied')
  return Promise.resolve(Notification.requestPermission()) as Promise<Berechtigung>
}

/**
 * Abonniert dieses Gerät beim Push-Dienst und liefert die Werte für `POST /push/abo/anlegen`.
 *
 * Ein vorhandenes Abonnement mit **anderem** Schlüssel wird erst gekündigt: `subscribe` würfe sonst
 * `InvalidStateError` (P7). Mit gleichem Schlüssel liefert `subscribe` das vorhandene zurück – ohne Dialog, wenn
 * die Berechtigung besteht; darauf baut der Start-Abgleich (E29).
 *
 * **Unbekannter Schlüssel des alten Abonnements** (manche Browser füllen `options.applicationServerKey` nicht): Dann
 * wird nicht vorsorglich gekündigt – sonst bekäme das Gerät bei jedem Start eine neue Adresse –, sondern erst, wenn
 * `subscribe` mit `InvalidStateError` antwortet.
 *
 * @param vapid Der öffentliche Schlüssel des Servers (base64url).
 */
export async function abonnieren(vapid: string): Promise<AboAnlegen> {
  const registrierung = await bereiteRegistrierung()
  const schluessel = base64urlZuBytes(vapid)
  const optionen = { userVisibleOnly: true, applicationServerKey: schluessel }
  try {
    const alt = await registrierung.pushManager.getSubscription()
    const altSchluessel = alt ? schluesselVon(alt) : null
    if (alt && altSchluessel && !gleicheBytes(altSchluessel, schluessel)) await alt.unsubscribe()
    let abo: PushSubscription
    try {
      abo = await registrierung.pushManager.subscribe(optionen)
    } catch (fehler) {
      if (!(alt && !altSchluessel && fehler instanceof DOMException && fehler.name === 'InvalidStateError')) throw fehler
      await alt.unsubscribe()
      abo = await registrierung.pushManager.subscribe(optionen)
    }
    const json = abo.toJSON()
    // Unverändert übernehmen (P8): kein Trimmen, kein Kleinschreiben. `p256dh`/`auth` aus `toJSON().keys`,
    // nicht selbst aus `getKey()` kodiert.
    return { endpoint: abo.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' }
  } catch (fehler) {
    if (fehler instanceof GeraetFehler) throw fehler
    if (fehler instanceof DOMException && fehler.name === 'NotAllowedError') {
      throw new GeraetFehler('abgelehnt', 'Benachrichtigungen sind im Browser nicht erlaubt.')
    }
    throw new GeraetFehler('browser', 'Der Browser konnte dieses Gerät nicht für Benachrichtigungen einrichten.')
  }
}

/**
 * Kündigt das Abonnement dieses Geräts im Browser.
 *
 * @returns Die Endpoint-Adresse des gekündigten Abonnements oder `null`, wenn keines bestand.
 */
export async function kuendigen(): Promise<string | null> {
  try {
    const abo = await vorhandenesAbo()
    if (!abo) return null
    const endpoint = abo.endpoint
    const erfolgt = await abo.unsubscribe()
    if (!erfolgt) throw new Error('unsubscribe lieferte false')
    return endpoint
  } catch {
    throw new GeraetFehler('browser', 'Der Browser konnte die Benachrichtigungen auf diesem Gerät nicht entfernen.')
  }
}

/**
 * Hört auf die Navigationsnachricht des Workers nach dem Antippen einer Benachrichtigung (E31).
 *
 * **`startMessages()` ist Pflicht:** Mit `addEventListener` statt `onmessage` bleiben Nachrichten des Workers sonst in
 * der Warteschlange. Der Pfad läuft noch einmal durch `zielPfad` (nur eigener Ursprung).
 *
 * @param beiZiel Wird mit dem Pfad aufgerufen, zu dem die Seite navigieren soll.
 * @returns Abmeldung des Hörers.
 */
export function navigationsNachrichtenHoeren(beiZiel: (pfad: string) => void): () => void {
  const sw = container()
  if (!sw) return () => {}
  const hoerer = (ereignis: MessageEvent) => {
    const daten = ereignis.data as { type?: unknown; url?: unknown } | null
    if (daten?.type === NACHRICHT_NAVIGIEREN) beiZiel(zielPfad(daten.url))
  }
  sw.addEventListener('message', hoerer)
  sw.startMessages()
  return () => sw.removeEventListener('message', hoerer)
}
