import { umgebungLesen } from './umgebung'

/** Attribut an `<html>`, solange die Anwendung als installierte App auf iOS läuft. */
export const IOS_APP_ATTRIBUT = 'data-ios-app'

/**
 * Kennzeichnet die installierte App auf iOS an `<html>` (01.11.2026), damit das CSS ihr oben mehr Luft gibt.
 *
 * **Warum per Skript und nicht per CSS allein:** Seit iOS 26 liegt in einer Web-App vom Home-Bildschirm eine weiche
 * Unschärfe des Systems am oberen Rand der Ansicht (Liquid Glass, „scroll edge effect“), rund 38–40pt hoch. Ohne
 * `apple-mobile-web-app-status-bar-style` beginnt die Ansicht unter der Statusleiste, und iOS meldet als Einzug 0 –
 * eine Regel, die sich am Einzug orientiert (`min(env(safe-area-inset-top), …)`), greift dann nicht. Daran scheiterten
 * die Korrekturen vom 31.10. und vom 01.11. auf dem iPhone. `navigator.standalone` gibt es nur auf iOS und ist dort in
 * der installierten App `true`; `display-mode: standalone` ist der zweite Weg (`umgebungLesen`).
 *
 * Läuft in `main.tsx` vor dem ersten Rendern, damit nichts springt.
 *
 * @param w Das Fenster; Vorgabe das globale.
 * @returns Ob die Kennzeichnung gesetzt wurde.
 */
export function iosAppKennzeichnen(w: Window = window): boolean {
  const umgebung = umgebungLesen(w)
  const iosApp = umgebung.ios && umgebung.standalone
  if (iosApp) {
    w.document.documentElement.setAttribute(IOS_APP_ATTRIBUT, '')
    statusleisteNachfaerben(w)
  }
  return iosApp
}

/** Attribut an `<html>`, solange das Deckband für das Nachfärben kurz ausgeblendet ist (`AppLayout`). */
export const BAND_NEU_ATTRIBUT = 'data-band-neu'

/** So lange bleibt das Band beim Wechsel verborgen; länger als ein Bild, kürzer als wahrnehmbar. */
export const BAND_PAUSE_MS = 120

/**
 * Lässt iOS die Farbe der Statusleiste nach einem Wechsel zwischen hellem und dunklem Modus neu abnehmen
 * (01.11.2026: Nach dem Wechsel blieb sie im hellen Modus schwarz).
 *
 * iOS 26 färbt die Statusleiste der installierten App nach der Seite (festes Element am oberen Rand oder Hintergrund)
 * und nimmt die Farbe offenbar nur ab, wenn oben ein Element erscheint oder verschwindet – nicht, wenn sich nur Farben
 * ändern (Berichte anderer Projekte, nicht von Apple dokumentiert). Bei jedem Wechsel blendet die Funktion deshalb das
 * Deckband kurz aus und wieder ein.
 *
 * @param w Das Fenster; Vorgabe das globale.
 * @returns Eine Funktion, die die Beobachtung beendet (für Tests).
 */
export function statusleisteNachfaerben(w: Window = window): () => void {
  if (typeof w.matchMedia !== 'function') return () => {}
  const abfrage = w.matchMedia('(prefers-color-scheme: dark)')
  if (typeof abfrage.addEventListener !== 'function') return () => {}
  const wurzel = w.document.documentElement
  let zeitgeber: ReturnType<typeof setTimeout> | undefined
  const beiWechsel = () => {
    wurzel.setAttribute(BAND_NEU_ATTRIBUT, '')
    clearTimeout(zeitgeber)
    zeitgeber = setTimeout(() => wurzel.removeAttribute(BAND_NEU_ATTRIBUT), BAND_PAUSE_MS)
  }
  abfrage.addEventListener('change', beiWechsel)
  return () => {
    abfrage.removeEventListener('change', beiWechsel)
    clearTimeout(zeitgeber)
    wurzel.removeAttribute(BAND_NEU_ATTRIBUT)
  }
}
