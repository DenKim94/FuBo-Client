import { useState } from 'react'
import Icon from '@/components/Icon/Icon'
import { useNetzfehlerGemeldet } from '@/hooks/useNetzfehlerMeldung'
import { useVerbindung } from '@/hooks/useVerbindung'
import style from './OfflineHinweis.module.scss'

/**
 * Zeigt einen Streifen, solange der Server nicht erreichbar ist – als Rückfall.
 *
 * **Warum der Zustand sichtbar sein muss:** Jede fachliche Aktion dieser
 * Anwendung braucht den Server – Zusagen, Teamgenerierung und Ergebniseintrag
 * laufen nirgends lokal (A25: Hinweis auf die nötige Serververbindung).
 *
 * **Nur einer meldet** (Entscheidung vom 04.10.2026): Zeigt die Ansicht selbst
 * einen Verbindungsfehler (`Fehlermeldung` mit Netzfehler), blendet sich der
 * Streifen aus (`useNetzfehlerGemeldet`). Er bleibt für Ansichten, die nichts
 * melden – etwa während des automatischen zweiten Versuchs einer Abfrage oder
 * wenn der Browser das Netz verliert, bevor ein Aufruf scheitert.
 *
 * **Er beansprucht keinen Platz:** Der Streifen legt sich über die Kopfzeile
 * (`position: fixed`), statt den Inhalt nach unten zu schieben. So löst er auf
 * Ansichten, die den Bildschirm genau füllen, kein Scrollen aus. Weil er dabei
 * die Zurück-Schaltfläche verdecken kann, lässt er sich wegklicken. Nach einem
 * Wegklicken bleibt er bis zum Ende dieses Verbindungsausfalls verborgen und
 * erscheint beim nächsten Ausfall wieder.
 *
 * **Was der Hinweis nicht tut:** Er sperrt keine Schaltflächen und legt keine
 * Warteschlange an. Eine lokal zwischengespeicherte Zusage widerspräche A15
 * (`teilnehmerVersion`) und A21 („der erste Eintrag gilt").
 *
 * Das Symbol kommt über `Icon`; die Datei liegt im Precache. Die
 * Schliessen-Schaltfläche zeichnet ihr Kreuz per CSS und hängt damit an keiner
 * Datei, die ohne Verbindung fehlen könnte.
 */
export default function OfflineHinweis() {
  const { verbunden } = useVerbindung()
  const vonAnsichtGemeldet = useNetzfehlerGemeldet()
  const [weggeklickt, setWeggeklickt] = useState(false)
  const [warVerbunden, setWarVerbunden] = useState(verbunden)

  // Neuer Ausfall, neuer Hinweis: Mit der wiederhergestellten Verbindung
  // verfällt das Wegklicken. Angepasst während des Renderns statt in einem
  // Effekt – so empfiehlt es React für Zustand, der aus einer Eigenschaft folgt.
  if (verbunden !== warVerbunden) {
    setWarVerbunden(verbunden)
    if (verbunden) setWeggeklickt(false)
  }

  if (verbunden || vonAnsichtGemeldet || weggeklickt) return null

  return (
    <div className={style.hinweis} role="status" data-testid="offline-hinweis">
      <span className={style.symbol}>
        <Icon name="no_connection_icon_red" />
      </span>
      <span className={style.text}>Keine Verbindung zum Server. Eingaben werden nicht gespeichert.</span>
      <button
        type="button"
        className={style.schliessen}
        aria-label="Hinweis schließen"
        onClick={() => setWeggeklickt(true)}
        data-testid="offline-hinweis-schliessen"
      />
    </div>
  )
}
