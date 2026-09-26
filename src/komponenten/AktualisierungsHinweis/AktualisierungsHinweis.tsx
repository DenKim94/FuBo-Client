import { useRegisterSW } from 'virtual:pwa-register/react'
import style from './AktualisierungsHinweis.module.scss'

/**
 * Zeigt einen unaufdringlichen Hinweis, sobald eine neue Fassung bereitsteht.
 *
 * Der Neuladevorgang bleibt ausdruecklich beim Nutzer (`registerType: 'prompt'`):
 * Bei `autoUpdate` laedt die Seite neu, sobald ein neuer Service Worker aktiv
 * wird. Traefe das jemanden mitten in der Ergebniserfassung, waere die Eingabe
 * verloren – und weil der erste Eintrag gilt (A21), ist das kein blosser
 * Komfortverlust.
 *
 * Die Gestaltung ist vorlaeufig; sie wird mit dem Design-System nachgezogen.
 */
export default function AktualisierungsHinweis() {
  const {
    needRefresh: [aktualisierungNoetig],
    updateServiceWorker,
  } = useRegisterSW()

  if (!aktualisierungNoetig) return null

  return (
    <div className={style.hinweis} role="status" data-testid="aktualisierung-hinweis">
      <span>Eine neue Version der App ist verfügbar.</span>
      <button
        type="button"
        className={style.schaltflaeche}
        onClick={() => void updateServiceWorker(true)}
        data-testid="aktualisierung-neuladen"
      >
        Jetzt aktualisieren
      </button>
    </div>
  )
}
