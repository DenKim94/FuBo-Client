import { VERLAUF_TAGE } from '@/api/termine/terminZeit'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import VerlaufListe from '@/components/VerlaufListe/VerlaufListe'
import { useVerlauf } from '@/hooks/useVerlauf'
import style from './VerlaufSeite.module.scss'

/**
 * Tab „Verlauf“ (`/verlauf`), C5, 10.4: die vergangenen Termine der letzten
 * {@link VERLAUF_TAGE} Tage, neueste zuerst (E14), mit dem Weg zu ihrem Ergebnis.
 *
 * **Die Zahl der Tage kommt aus der Konstante**, nicht aus einem Text: Abruf und Satz
 * unter der Liste teilen sich `VERLAUF_TAGE` und können nicht auseinanderlaufen.
 * Kein Polling, kein „Mehr laden“ (dafür fehlt dem Vertrag ein `bis` oder ein Limit).
 */
export default function VerlaufSeite() {
  const verlauf = useVerlauf()
  const daten = verlauf.data

  let inhalt
  if (!daten) {
    inhalt = verlauf.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Verlauf wird geladen" />
    ) : (
      <Fehlerzustand
        fehler={verlauf.error}
        erneut={() => void verlauf.refetch()}
        data-testid="verlauf-fehler-zustand"
      />
    )
  } else if (daten.vergangene.length === 0) {
    inhalt = (
      <Leerzustand
        titel="Noch keine vergangenen Termine"
        text={`Termine der letzten ${String(VERLAUF_TAGE)} Tage erscheinen hier, sobald sie vorbei sind.`}
        data-testid="verlauf-leer"
      />
    )
  } else {
    inhalt = (
      <>
        <VerlaufListe termine={daten.vergangene} />
        <p className={style.hinweis} data-testid="verlauf-hinweis">
          Angezeigt werden die Termine der letzten {VERLAUF_TAGE} Tage.
        </p>
      </>
    )
  }

  return (
    <div className={style.seite} data-testid="verlauf-seite">
      <h1 className={style.titel}>Verlauf</h1>
      {inhalt}
    </div>
  )
}
