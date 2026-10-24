import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import { heuteIso } from '@/api/termine/terminZeit'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Hinweis from '@/components/Hinweis/Hinweis'
import Textlink from '@/components/Textlink/Textlink'
import { useTerminAendern } from '@/hooks/admin/useTerminAendern'
import { useTermin } from '@/hooks/useTermin'
import TerminErgebnis from './TerminErgebnis'
import TerminHalle from './TerminHalle'
import TerminAendernFormular from './TerminAendernFormular'
import WeitereAktionen from './WeitereAktionen'
import style from './AdminTerminDetail.module.scss'

/** Eigenschaften der Verwaltungsabschnitte. */
type TerminVerwaltungEigenschaften = {
  terminId: number
  /** Überschrift der `TerminKarte`: Fokusziel nach einem Statuswechsel. */
  ueberschriftRef: RefObject<HTMLHeadingElement | null>
}

/**
 * Die Abschnitte der Verwaltungsansicht eines Termins (C7 8.4), als Kinder von `TerminAnsicht`.
 *
 * Liest über `useTermin(terminId, 0)` **denselben Cache-Eintrag** wie die Ansicht darüber (kein zweiter Hook, kein
 * zweiter Schlüssel) und zeigt die Abschnitte nur, wenn Daten da sind; Laden, `404` und Fehler zeigt `TerminAnsicht`.
 *
 * **Reihenfolge der Abschnitte** (jeder ein eigener Baustein, damit C8 sie einhängen kann):
 * „Termin ändern“ (`GEPLANT`) – C8: „Hallenabsage“, „Ergebnis“ (`ABGESCHLOSSEN`) – „Weitere Aktionen“. Die Stufe eines
 * Gastes ändert der Admin seit 24.10.2026 nur in der Gäste-Verwaltung (`/admin/gaeste`).
 *
 * **E5:** Dieser Baustein besitzt Abfrage **und** Mutation des Änderungsformulars. `key={termin.version}` baut das
 * Formular nach jedem Stand neu auf; die Meldung zu `DATEN_VERALTET` überlebt den Neuaufbau, weil sie in der Mutation
 * liegt.
 */
export default function TerminVerwaltung({ terminId, ueberschriftRef }: TerminVerwaltungEigenschaften) {
  const abfrage = useTermin(terminId, 0)
  const aendern = useTerminAendern()
  // Einmal beim Einhängen: `min` der Datumsfelder; die Uhr gehört nicht in den Render.
  const [heute] = useState(() => heuteIso(new Date()))
  const [fokusSpeichern, setFokusSpeichern] = useState(false)
  const fokusUeberschrift = useRef(false)
  const [, neuZeichnen] = useState(0)

  // Nach einem Statuswechsel gehört der Fokus auf die Überschrift der Karte. Der Effekt läuft nach dem Neuaufbau und
  // nach dem Effekt eines geschlossenen Dialogs (der gibt den Fokus an den Auslöser zurück, den es nicht mehr gibt).
  useEffect(() => {
    if (!fokusUeberschrift.current) return
    fokusUeberschrift.current = false
    ueberschriftRef.current?.focus()
  })

  const beiGespeichert = useCallback(() => {
    setFokusSpeichern(true)
  }, [])
  const beiFokussiert = useCallback(() => {
    setFokusSpeichern(false)
  }, [])

  /** Merkzeichen plus ein Render: Kam der neue Stand schon vor dem Aufruf an, liefe sonst kein Effekt mehr. */
  const zurUeberschrift = useCallback(() => {
    fokusUeberschrift.current = true
    neuZeichnen((n) => n + 1)
  }, [])

  const termin = abfrage.data
  if (!termin) return null

  if (abfrage.error instanceof ApiFehler && abfrage.error.status === 404) {
    return (
      <div className={style.verwaltung}>
        <Hinweis data-testid="admin-termin-verschwunden">Der Termin existiert nicht mehr.</Hinweis>
        <Textlink to={ADMIN_PFADE.termine} data-testid="admin-termin-zur-liste">
          Zu den Terminen
        </Textlink>
      </div>
    )
  }

  const geschlossen = aendern.error instanceof ApiFehler && aendern.error.code === 'TERMIN_GESCHLOSSEN'

  return (
    <div className={style.verwaltung} data-testid="admin-termin-verwaltung">
      {geschlossen && <Hinweis data-testid="admin-termin-nicht-mehr-geplant">Der Termin ist nicht mehr geplant.</Hinweis>}

      {termin.status === 'GEPLANT' && (
        <section className={style.abschnitt} aria-labelledby="admin-termin-aendern-titel" data-testid="admin-termin-aendern-abschnitt">
          <h2 id="admin-termin-aendern-titel" className={style.abschnittTitel}>
            Termin ändern
          </h2>
          <TerminAendernFormular
            key={termin.version}
            termin={termin}
            aendern={aendern}
            heute={heute}
            beiGespeichert={beiGespeichert}
            fokusAufSpeichern={fokusSpeichern}
            beiFokussiert={beiFokussiert}
          />
        </section>
      )}


      <TerminHalle termin={termin} fokusAufUeberschrift={zurUeberschrift} />

      <TerminErgebnis termin={termin} />

      <WeitereAktionen termin={termin} fokusAufUeberschrift={zurUeberschrift} />
    </div>
  )
}
