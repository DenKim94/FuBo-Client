import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import { VERLAUF_TAGE, vergangeneTermine } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import AdminTerminZeile from '@/components/AdminTerminZeile/AdminTerminZeile'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import Textlink from '@/components/Textlink/Textlink'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { useTermine } from '@/hooks/useTermine'
import { useVerlauf } from '@/hooks/useVerlauf'
import style from './AdminTermine.module.scss'

/** Liste von Terminzeilen in einem gemeinsamen Rahmen. */
function Zeilen({ termine, testId }: { termine: readonly TerminUebersicht[]; testId: string }) {
  return (
    <ul className={style.liste} data-testid={testId}>
      {termine.map((termin) => (
        <li key={termin.terminId}>
          <AdminTerminZeile termin={termin} />
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
 * **Grenze:** Termine, die länger als {@link VERLAUF_TAGE} Tage zurückliegen, sind hier nicht erreichbar
 * (dasselbe Fenster wie der Verlauf). Ein grösseres Fenster wäre eine spätere Entscheidung.
 */
export default function AdminTermine() {
  const kommende = useTermine()
  const verlauf = useVerlauf()
  const hinweis = useNavigationsHinweis()
  const navigate = useNavigate()
  const [jetzt] = useState(() => new Date())

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
        <Zeilen termine={liste} testId="admin-termine-kommende-liste" />
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
        <Zeilen termine={verlauf.data.vergangene} testId="admin-termine-vergangene-liste" />
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
        <h1 className={style.titel}>Termine</h1>
        {hinweis.hinweis !== null && <Hinweis data-testid="admin-termine-hinweis">{hinweis.hinweis}</Hinweis>}

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
      </Aktionsleiste>
    </section>
  )
}
