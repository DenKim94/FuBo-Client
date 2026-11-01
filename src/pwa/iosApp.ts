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
  if (iosApp) w.document.documentElement.setAttribute(IOS_APP_ATTRIBUT, '')
  return iosApp
}
