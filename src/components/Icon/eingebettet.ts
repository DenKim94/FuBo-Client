// Bewusst relative Pfade in `public/` statt einer Kopie unter `src/`: Die
// Symbole bleiben an einem Ort (AGENT_CLIENT.md: Icons liegen in
// `public/icons/`), und `?raw` liest sie beim Bau als Text ins Bündel.
import fehlerSvg from '../../../public/icons/error_circle_icon.svg?raw'
import keineVerbindungSvg from '../../../public/icons/no_connection_icon_red.svg?raw'

/**
 * Wandelt SVG-Quelltext in einen CSS-Wert `url("data:…")` für die Maske.
 *
 * `encodeURIComponent` statt Base64: kürzer für Text, und `#` in Farbwerten
 * beendete die Daten-URL sonst vorzeitig.
 */
function alsDatenUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.trim())}")`
}

/**
 * Symbole, die **ohne Verbindung** angezeigt werden müssen, eingebettet ins Bündel.
 *
 * `Icon` lädt seine Datei sonst zur Laufzeit von `/icons/`. Genau das scheitert
 * in dem Moment, in dem die Fehlermeldung erscheint: Ist der Server der
 * Anwendung nicht erreichbar (Entwicklungsserver aus, erster Besuch ohne
 * aktiven Service Worker, Netz weg), bleibt die Maske leer und die Meldung
 * ohne Symbol (Fehlerbild vom 04.10.2026). Was im geladenen JavaScript steckt,
 * braucht dagegen keinen weiteren Abruf.
 *
 * Nur diese beiden, weil jedes eingebettete Symbol das Bündel vergrössert
 * (zusammen rund 1,5 kB) und alle übrigen Symbole bei bestehender Verbindung
 * erscheinen.
 */
export const EINGEBETTETE_ICONS: Readonly<Record<string, string>> = {
  error_circle_icon: alsDatenUrl(fehlerSvg),
  no_connection_icon_red: alsDatenUrl(keineVerbindungSvg),
}
