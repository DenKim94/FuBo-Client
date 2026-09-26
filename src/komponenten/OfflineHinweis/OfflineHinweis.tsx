import { useVerbindung } from '@/hooks/useVerbindung'
import style from './OfflineHinweis.module.scss'

/**
 * Zeigt einen Streifen, solange der Server nicht erreichbar ist.
 *
 * **Warum der Zustand sichtbar sein muss:** Jede fachliche Aktion dieser
 * Anwendung braucht den Server – Zusagen, Teamgenerierung und Ergebniseintrag
 * laufen nirgends lokal. Ohne diesen Hinweis zerfiele „offline" in einzelne
 * Fehlermeldungen an jeder Schaltfläche, und der Nutzer suchte den Grund bei
 * sich.
 *
 * **Was der Hinweis nicht tut:** Er sperrt keine Schaltflächen und legt keine
 * Warteschlange an. Eine lokal zwischengespeicherte Zusage widerspräche A15
 * (`teilnehmerVersion`) und A21 („der erste Eintrag gilt").
 *
 * Die Gestaltung ist vorläufig; sie wird mit dem Design-System in C2
 * nachgezogen.
 */
export default function OfflineHinweis() {
  const { verbunden } = useVerbindung()

  if (verbunden) return null

  return (
    <div className={style.hinweis} role="status" data-testid="offline-hinweis">
      {/* Dekorativ: Die Aussage steht im Text, das Symbol trägt sie nur mit.
          Als CSS-Hintergrund und nicht als `img`, weil ein Symbol, das ohne
          aktiven Service Worker noch nicht im Precache liegt, sonst als
          kaputtes Bild erschiene – ausgerechnet im Fehlerfall. */}
      <span className={style.symbol} aria-hidden="true" />
      <span>Keine Verbindung. Die Anwendung braucht den Server; Eingaben werden nicht gespeichert.</span>
    </div>
  )
}
