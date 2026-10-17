import { datumKurz } from '@/api/termine/terminZeit'
import { naechsterTermin } from '@/api/termine/terminZeit'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import TerminAnsicht from '@/components/TerminAnsicht/TerminAnsicht'
import WeitereTermine from '@/components/WeitereTermine/WeitereTermine'
import { useTermine } from '@/hooks/useTermine'
import style from './Dashboard.module.scss'

/** Höchstzahl der Hinweise auf abgesagte Termine vor dem nächsten geplanten. */
const MAX_ABSAGEHINWEISE = 2

/**
 * Tab „Termine“ (`/`): der nächste Termin mit Zu- und Absage (A7, C5, 7).
 *
 * Zeigt den ersten geplanten Termin (E2) mit eingeklappter Teilnehmerliste (E9)
 * und darunter die weiteren Termine. **Abgesagte Termine davor** stehen als
 * Hinweis darüber („Der Termin am Di, 29. Juli fällt aus.“), höchstens zwei, und
 * erscheinen nicht noch einmal in der Liste. Ohne geplanten Termin steht ein
 * Leerzustand mit Grund.
 *
 * Die Seite ist dünn: Zusage, Balken, Liste und Leiste kommen aus `TerminAnsicht`.
 * Admin-Zweige gibt es nicht (E7); `DashboardLayout` leitet den Admin um.
 */
export default function Dashboard() {
  const termine = useTermine()
  const liste = termine.data

  if (!liste) {
    return termine.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Termine werden geladen" />
    ) : (
      <Fehlerzustand fehler={termine.error} erneut={() => void termine.refetch()} data-testid="dashboard-fehler" />
    )
  }

  const { termin, abgesagtDavor } = naechsterTermin(liste)
  const index = termin ? liste.findIndex((t) => t.terminId === termin.terminId) : -1
  // Nach dem nächsten Termin; abgeschlossene gibt es dort nicht, vergangene stehen im „Verlauf“.
  const weitere = liste.slice(index + 1).filter((t) => t.status === 'GEPLANT' || t.status === 'ABGESAGT')

  return (
    <section className={style.dashboard} data-testid="dashboard">
      {termine.failureReason && !termin && (
        <Fehlermeldung fehler={termine.failureReason} data-testid="dashboard-fehler-meldung" />
      )}

      {abgesagtDavor.length > 0 && (
        <div className={style.hinweise}>
          {abgesagtDavor.slice(0, MAX_ABSAGEHINWEISE).map((t) => (
            <Hinweis key={t.terminId} data-testid={`dashboard-abgesagt-${t.terminId}`}>
              Der Termin am {datumKurz(t.datum)} fällt aus.
            </Hinweis>
          ))}
          {abgesagtDavor.length > MAX_ABSAGEHINWEISE && (
            <Hinweis data-testid="dashboard-abgesagt-mehr">… und weitere abgesagte Termine</Hinweis>
          )}
        </div>
      )}

      {termin ? (
        <TerminAnsicht terminId={termin.terminId} eingeklappt>
          <WeitereTermine termine={weitere} />
        </TerminAnsicht>
      ) : (
        <Leerzustand
          titel="Kein Termin geplant"
          text="Sobald der Admin einen Termin anlegt, erscheint er hier."
          titelEbene={1}
          data-testid="dashboard-leer"
        />
      )}
    </section>
  )
}
