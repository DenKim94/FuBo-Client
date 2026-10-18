import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { datumKurz, uhrzeitKurz } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import Icon from '@/components/Icon/Icon'
import style from './VerlaufListe.module.scss'

/** Eigenschaften der Verlaufsliste. */
type VerlaufListeEigenschaften = {
  /** Vergangene Termine, neueste zuerst (aus `useVerlauf`). */
  termine: readonly TerminUebersicht[]
}

/**
 * Vergangene Termine als Liste (C5, 10.4): Datum, Uhrzeit, Ort (nur wenn vorhanden),
 * Status und bei einem abgeschlossenen Termin die Zahl der Zusagen.
 *
 * **Reihenfolge wie geliefert:** `useVerlauf` liefert neueste zuerst; die Liste sortiert
 * nicht erneut.
 *
 * **Der Status hängt nicht an der Farbe:** „Abgeschlossen“ und „Abgesagt“ tragen Symbol
 * **und** Text. Eine Zeile mit `ABGESCHLOSSEN` ist ein Link auf `ergebnisse/:terminId`
 * (mindestens 44 px hoch, die ganze Zeile ist das Tap-Ziel); `ABGESAGT` ist **kein**
 * Link, denn hinter einem abgesagten Termin steht kein Ergebnis. Die Zusagen stehen nur
 * beim abgeschlossenen Termin: Eine Absage leert die Teilnehmerliste, „0 Zusagen“ wäre
 * dort eine falsche Auskunft. Ein Ergebnis je Zeile zeigt die Liste nicht (das hieße
 * einen Abruf je Termin); es steht hinter dem Link.
 */
export default function VerlaufListe({ termine }: VerlaufListeEigenschaften) {
  return (
    <ul className={style.liste} data-testid="verlauf-liste">
      {termine.map((termin) => {
        const abgeschlossen = termin.status === 'ABGESCHLOSSEN'
        const inhalt = <Zeileninhalt termin={termin} />
        return (
          <li key={termin.terminId}>
            {abgeschlossen ? (
              <Link
                className={style.zeile}
                to={`/ergebnisse/${termin.terminId}`}
                data-testid={`verlauf-link-${termin.terminId}`}
              >
                {inhalt}
              </Link>
            ) : (
              <div className={`${style.zeile} ${style.ohneLink}`} data-testid={`verlauf-zeile-${termin.terminId}`}>
                {inhalt}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Inhalt einer Zeile: links Zeit und Ort, rechts Status und Zusagen. */
function Zeileninhalt({ termin }: { termin: TerminUebersicht }): ReactNode {
  const ort = termin.ort?.trim()
  const abgeschlossen = termin.status === 'ABGESCHLOSSEN'
  return (
    <>
      <span className={style.zeit}>
        <span className={style.datum}>
          {datumKurz(termin.datum)} · {uhrzeitKurz(termin.uhrzeit)} Uhr
        </span>
        {ort && <span className={style.ort}>{ort}</span>}
      </span>
      <span className={style.stand}>
        <span className={`${style.status} ${abgeschlossen ? '' : style.abgesagt}`}>
          <Icon name={abgeschlossen ? 'check_circle_icon' : 'block_icon_red'} />
          <span>{abgeschlossen ? 'Abgeschlossen' : 'Abgesagt'}</span>
        </span>
        {abgeschlossen && <span className={style.zusagen}>{termin.zusagen} Zusagen</span>}
      </span>
    </>
  )
}
