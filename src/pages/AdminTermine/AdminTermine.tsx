import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import { VERLAUF_TAGE, datumLang, uhrzeitKurz, vergangeneTermine } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import AdminTerminZeile from '@/components/AdminTerminZeile/AdminTerminZeile'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import Textlink from '@/components/Textlink/Textlink'
import { useTerminEntfernen } from '@/hooks/admin/useTerminEntfernen'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { useTermine } from '@/hooks/useTermine'
import { useVerlauf } from '@/hooks/useVerlauf'
import style from './AdminTermine.module.scss'

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ_ENTFERNEN = 'Der Termin konnte nicht entfernt werden. Bitte versuche es erneut.'

/** Was nach dem Entfernen auf der Liste steht (ein Hinweis, nie ein Fehler: der Fehler steht im Dialog). */
type Meldung =
  | { art: 'entfernt' }
  | { art: 'verschwunden' }
  | { art: 'inVerwendung'; terminId: number }

/** Liste von Terminkarten. */
function Zeilen({
  termine,
  testId,
  beiEntfernen,
}: {
  termine: readonly TerminUebersicht[]
  testId: string
  beiEntfernen: (termin: TerminUebersicht) => void
}) {
  return (
    <ul className={style.liste} data-testid={testId}>
      {termine.map((termin) => (
        <li key={termin.terminId}>
          <AdminTerminZeile termin={termin} beiEntfernen={beiEntfernen} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Terminliste des Admins (`/admin/termine`, C7 8.2): kommende Termine und der Verlauf der letzten Tage.
 *
 * **Zwei Abschnitte, zwei Quellen, zwei Zustände:** „Kommende Termine“ liest `useTermine` (Polling wie am
 * Dashboard), „Vergangene Termine“ `useVerlauf` (E9). Jeder Abschnitt hat seinen **eigenen** Lade-, Leer- und
 * Fehlerzustand; fällt der eine aus, bleibt der andere benutzbar.
 *
 * **Keine Dopplung:** Die Liste der kommenden Termine beginnt „heute“ und enthält auch einen heute schon
 * abgeschlossenen oder abgesagten Termin; er gehört in den Verlauf. Die Trennung nutzt dieselbe Regel wie
 * der Verlauf (`vergangeneTermine`) mit einem **einmal beim Einhängen** gelesenen Zeitpunkt – die Uhr gehört
 * nicht in den Render.
 *
 * **Entfernen aus der Liste** (Prototyp 10): Die Karte bietet „Entfernen“ für `GEPLANT` und `ABGESAGT`; die
 * `Bestaetigung` nennt Termin und Folgen und bleibt bei einem Fehler offen. `409 TERMIN_IN_VERWENDUNG` schliesst
 * sie und weist per Hinweis auf die Verwaltung des Termins (dort lässt er sich absagen); `404` meldet, dass es
 * den Termin nicht mehr gibt. Erfolg und Hinweis stehen auf der Liste; der Fokus geht auf die Überschrift, weil
 * die Karte mit der gedrückten Schaltfläche verschwindet. `mutateAsync`, weil die Karte beim Neulesen
 * ausgehängt wird.
 *
 * **Grenze:** Termine, die länger als {@link VERLAUF_TAGE} Tage zurückliegen, sind hier nicht erreichbar
 * (dasselbe Fenster wie der Verlauf). Ein grösseres Fenster wäre eine spätere Entscheidung.
 */
export default function AdminTermine() {
  const kommende = useTermine()
  const verlauf = useVerlauf()
  const hinweis = useNavigationsHinweis()
  const navigate = useNavigate()
  const [jetzt] = useState(() => new Date())
  const [zuEntfernen, setZuEntfernen] = useState<TerminUebersicht | null>(null)
  const [meldung, setMeldung] = useState<Meldung | null>(null)
  const entfernen = useTerminEntfernen()
  const titel = useRef<HTMLHeadingElement>(null)
  const fokusAufTitel = useRef(false)

  // Mit dem Entfernen verschwindet die Karte samt der gedrückten Schaltfläche; der Dialog gibt den Fokus an ein
  // Element zurück, das es nicht mehr gibt. Der Effekt läuft nach dem des Dialogs und setzt ihn auf die Überschrift.
  useEffect(() => {
    if (!fokusAufTitel.current) return
    fokusAufTitel.current = false
    titel.current?.focus()
  })

  function entfernenOeffnen(termin: TerminUebersicht) {
    entfernen.reset()
    setMeldung(null)
    setZuEntfernen(termin)
  }

  /** Entfernt den Termin; bei Erfolg und bei `404` bleibt die Liste, der Dialog schliesst. */
  async function entfernenAusfuehren() {
    if (!zuEntfernen || entfernen.isPending) return
    try {
      await entfernen.mutateAsync(zuEntfernen.terminId)
      fokusAufTitel.current = true
      setMeldung({ art: 'entfernt' })
      setZuEntfernen(null)
    } catch (fehler) {
      if (!(fehler instanceof ApiFehler)) return
      if (fehler.code === 'TERMIN_IN_VERWENDUNG') {
        setMeldung({ art: 'inVerwendung', terminId: zuEntfernen.terminId })
        setZuEntfernen(null)
      } else if (fehler.status === 404) {
        setMeldung({ art: 'verschwunden' })
        setZuEntfernen(null)
      }
    }
  }

  let kommendeInhalt
  if (kommende.data) {
    const vergangen = new Set(vergangeneTermine(kommende.data, jetzt).map((t) => t.terminId))
    const liste = kommende.data.filter((t) => !vergangen.has(t.terminId))
    kommendeInhalt =
      liste.length === 0 ? (
        <Leerzustand
          titel="Keine kommenden Termine"
          text="Lege einen Termin an, damit sich die Spieler zurückmelden können."
          aktion={
            <Textlink to={ADMIN_PFADE.terminNeu} data-testid="admin-termine-leer-anlegen">
              Termin anlegen
            </Textlink>
          }
          data-testid="admin-termine-kommende-leer"
        />
      ) : (
        <Zeilen termine={liste} testId="admin-termine-kommende-liste" beiEntfernen={entfernenOeffnen} />
      )
  } else if (kommende.isPending) {
    kommendeInhalt = <Ladespinner groesse="gross" zentriert text="Termine werden geladen" />
  } else {
    kommendeInhalt = (
      <Fehlerzustand
        fehler={kommende.error}
        erneut={() => void kommende.refetch()}
        data-testid="admin-termine-kommende-fehler"
      />
    )
  }

  let verlaufInhalt
  if (verlauf.data) {
    verlaufInhalt =
      verlauf.data.vergangene.length === 0 ? (
        <Leerzustand
          titel="Keine vergangenen Termine"
          text={`In den letzten ${String(VERLAUF_TAGE)} Tagen gab es keinen abgeschlossenen oder abgesagten Termin.`}
          data-testid="admin-termine-vergangene-leer"
        />
      ) : (
        <Zeilen termine={verlauf.data.vergangene} testId="admin-termine-vergangene-liste" beiEntfernen={entfernenOeffnen} />
      )
  } else if (verlauf.isPending) {
    verlaufInhalt = <Ladespinner groesse="gross" zentriert text="Verlauf wird geladen" />
  } else {
    verlaufInhalt = (
      <Fehlerzustand
        fehler={verlauf.error}
        erneut={() => void verlauf.refetch()}
        data-testid="admin-termine-vergangene-fehler"
      />
    )
  }

  return (
    <section className={style.seite} data-testid="admin-termine">
      <div className={style.bereich}>
        <h1 ref={titel} tabIndex={-1} className={style.titel}>
          Termine
        </h1>
        {hinweis.hinweis !== null && <Hinweis data-testid="admin-termine-hinweis">{hinweis.hinweis}</Hinweis>}
        {meldung?.art === 'entfernt' && <Hinweis data-testid="admin-termine-entfernt">Termin entfernt.</Hinweis>}
        {meldung?.art === 'verschwunden' && (
          <Hinweis data-testid="admin-termine-verschwunden">Der Termin existiert nicht mehr.</Hinweis>
        )}
        {meldung?.art === 'inVerwendung' && (
          <>
            <Hinweis data-testid="admin-termine-in-verwendung">
              Am Termin hängen Rückmeldungen oder Teams; er lässt sich nicht entfernen.
            </Hinweis>
            <Textlink to={ADMIN_PFADE.terminVerwaltung(meldung.terminId)} data-testid="admin-termine-in-verwendung-link">
              Termin öffnen, um ihn abzusagen
            </Textlink>
          </>
        )}

        <section className={style.abschnitt} aria-labelledby="admin-termine-kommende-titel">
          <h2 id="admin-termine-kommende-titel" className={style.abschnittTitel}>
            Kommende Termine
          </h2>
          {kommendeInhalt}
        </section>

        <section className={style.abschnitt} aria-labelledby="admin-termine-vergangene-titel">
          <h2 id="admin-termine-vergangene-titel" className={style.abschnittTitel}>
            Vergangene Termine (letzte {VERLAUF_TAGE} Tage)
          </h2>
          {verlaufInhalt}
        </section>
      </div>

      <Aktionsleiste>
        <CustomButton
          art="primaer"
          breit
          className={style.aktion}
          onClick={() => void navigate(ADMIN_PFADE.terminNeu)}
          data-testid="admin-termin-anlegen"
        >
          Termin anlegen
        </CustomButton>

        <Bestaetigung
          offen={zuEntfernen !== null}
          titel="Termin entfernen?"
          bestaetigenText="Termin entfernen"
          art="gefahr"
          laedt={entfernen.isPending}
          fehler={zuEntfernen !== null ? entfernen.error : null}
          fehlerErsatz={FEHLER_ERSATZ_ENTFERNEN}
          beiBestaetigen={() => void entfernenAusfuehren()}
          beiAbbruch={() => {
            setZuEntfernen(null)
          }}
          data-testid="admin-termine-entfernen-dialog"
        >
          <p>
            {zuEntfernen
              ? `Der Termin am ${datumLang(zuEntfernen.datum)}, ${uhrzeitKurz(zuEntfernen.uhrzeit)} Uhr wird entfernt. `
              : ''}
            Das lässt sich nicht rückgängig machen.
          </p>
        </Bestaetigung>
      </Aktionsleiste>
    </section>
  )
}
