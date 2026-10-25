/**
 * Eigenschaften des Browsers, die für Installation und Push zählen (C9, 4.1).
 *
 * Reine Funktionen mit übergebenem `window`: ohne React und ohne echten Browser testbar.
 */

/** Was der Browser kann und wie die Anwendung läuft. */
export type Umgebung = {
  /** iPhone, iPad oder iPod (auch iPadOS, das sich als „Macintosh“ meldet). */
  ios: boolean
  /** Läuft als installierte App (`display-mode: standalone` oder `navigator.standalone` auf iOS). */
  standalone: boolean
  /** Sicherer Ursprung (`https` oder `localhost`); sonst fehlen Service Worker und Push (P11). */
  sicher: boolean
  /** Service Worker, `PushManager` und `Notification` sind vorhanden. Auf iOS erst in der abgelegten App. */
  pushMoeglich: boolean
}

/**
 * Erkennt iOS am User-Agent. iPadOS meldet sich seit Version 13 als „Macintosh“ und ist nur am Touch erkennbar.
 *
 * @param ua `navigator.userAgent`.
 * @param maxTouchPoints `navigator.maxTouchPoints` (ein Mac ohne Touch hat `0`).
 */
export function istIos(ua: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && maxTouchPoints > 1)
}

/**
 * Liest die {@link Umgebung} aus einem Fenster.
 *
 * `matchMedia` fehlt in jsdom und in sehr alten Browsern; dann gilt nur `navigator.standalone`.
 *
 * @param w Das Fenster; Vorgabe das globale.
 */
export function umgebungLesen(w: Window = window): Umgebung {
  const navigator = w.navigator as Navigator & { standalone?: boolean }
  const anzeige = typeof w.matchMedia === 'function' && w.matchMedia('(display-mode: standalone)').matches
  return {
    ios: istIos(navigator.userAgent ?? '', navigator.maxTouchPoints ?? 0),
    standalone: anzeige || navigator.standalone === true,
    sicher: w.isSecureContext === true,
    pushMoeglich: 'serviceWorker' in navigator && 'PushManager' in w && 'Notification' in w,
  }
}
