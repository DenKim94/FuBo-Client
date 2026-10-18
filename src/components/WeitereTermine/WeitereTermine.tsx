import { Link } from 'react-router'
import { datumKurz, uhrzeitKurz } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import Icon from '@/components/Icon/Icon'
import Zusagestatus from '@/components/Zusagestatus/Zusagestatus'
import style from './WeitereTermine.module.scss'

/** Höchstzahl der Zeilen auf dem Dashboard; vergangene Termine stehen im Tab „Verlauf“. */
const MAX_ZEILEN = 5

/** Eigenschaften der Liste weiterer Termine. */
type WeitereTermineEigenschaften = {
  /** Termine nach dem nächsten geplanten, in Serverreihenfolge (`GEPLANT` und `ABGESAGT`). */
  termine: readonly TerminUebersicht[]
  /** Höchstzahl der Zeilen. */
  max?: number
}

/**
 * Weitere Termine unter dem nächsten Termin (C5, 7): Datum, Uhrzeit, Ort, Zahl der
 * Zusagen und die eigene Rückmeldung in knapper Form.
 *
 * Jede Zeile ist ein Link auf `termine/:terminId`, mindestens 44 px hoch.
 * Abgesagte Termine tragen „Abgesagt“ (Symbol **und** Text) statt der Rückmeldung.
 * Ohne Termine rendert die Komponente nichts. Es gibt kein „Mehr anzeigen“:
 * Danach beginnt der Tab „Verlauf“.
 */
export default function WeitereTermine({ termine, max = MAX_ZEILEN }: WeitereTermineEigenschaften) {
  if (termine.length === 0) return null

  return (
    <section className={style.bereich} aria-labelledby="weitere-termine-titel" data-testid="weitere-termine">
      <h2 id="weitere-termine-titel" className={style.titel}>
        Weitere Termine
      </h2>
      <ul className={style.liste}>
        {termine.slice(0, max).map((termin) => (
          <li key={termin.terminId}>
            <Link
              className={style.zeile}
              to={`/termine/${termin.terminId}`}
              data-testid={`termin-link-${termin.terminId}`}
            >
              <span className={style.zeit}>
                <span className={style.datum}>
                  {datumKurz(termin.datum)} · {uhrzeitKurz(termin.uhrzeit)} Uhr
                </span>
                {termin.ort?.trim() && <span className={style.ort}>{termin.ort.trim()}</span>}
              </span>
              {termin.status === 'ABGESAGT' ? (
                <span className={style.abgesagt}>
                  <Icon name="block_icon_red" />
                  <span>Abgesagt</span>
                </span>
              ) : (
                <span className={style.stand}>
                  <Zusagestatus rueckmeldung={termin.eigeneRueckmeldung ?? null} kompakt />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
