import Icon from '@/components/Icon/Icon'
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
 * **Das Symbol** kommt über `Icon` (CSS-Maske in der Textfarbe des Streifens).
 * Die Datei `no_connection_icon_red.svg` liegt weiterhin im Precache: Auch als
 * Maske wird sie geladen, und offline gibt es sie nur von dort. Ohne aktiven
 * Service Worker (erster Besuch) fehlt sie – dann bleibt die Maske leer, und
 * anders als ein `<img>` erscheint kein kaputtes Bild. Die Aussage steht im
 * Text, das Symbol trägt sie nur mit.
 */
export default function OfflineHinweis() {
  const { verbunden } = useVerbindung()

  if (verbunden) return null

  return (
    <div className={style.hinweis} role="status" data-testid="offline-hinweis">
      <span className={style.symbol}>
        <Icon name="no_connection_icon_red" />
      </span>
      <span>Keine Verbindung. Die Anwendung braucht den Server; Eingaben werden nicht gespeichert.</span>
    </div>
  )
}
