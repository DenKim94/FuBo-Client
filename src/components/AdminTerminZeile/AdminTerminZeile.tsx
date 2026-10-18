import { Link } from 'react-router'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import { datumLang, datumListe, uhrzeitKurz } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import Icon from '@/components/Icon/Icon'
import style from './AdminTerminZeile.module.scss'

/** Eigenschaften einer Terminzeile. */
type AdminTerminZeileEigenschaften = {
  termin: TerminUebersicht
}

/** Symbol und Text je Status; die Aussage steht im Wort, nicht in der Farbe. */
const STATUS = {
  GEPLANT: { symbol: 'info_circle_icon', text: 'Geplant' },
  ABGESAGT: { symbol: 'block_icon_red', text: 'Abgesagt' },
  ABGESCHLOSSEN: { symbol: 'check_circle_icon', text: 'Abgeschlossen' },
} as const

/**
 * Eine Zeile der Terminliste des Admins (C7, 8.2): „Di., 20.10. · 20:00 Uhr“, Ort, Status, Zusagen, „Serie“.
 *
 * **Die ganze Zeile ist der Link** zur Verwaltung, auch bei einem abgesagten Termin (dort wird er
 * entfernt) und bei einem abgeschlossenen (dort wird das Ergebnis korrigiert, C8). Anders als
 * `VerlaufListe` führt also keine Zeile ins Leere.
 *
 * **Die Zahl der Zusagen steht nur bei `GEPLANT` und `ABGESCHLOSSEN`:** Eine Absage leert die Liste
 * nicht, aber „0 Zusagen“ wäre bei einem abgesagten Termin eine falsche Auskunft. Der Serienhinweis
 * hängt an `serieId !== null`. Der Screenreader hört die ausgeschriebene Form des Datums.
 */
export default function AdminTerminZeile({ termin }: AdminTerminZeileEigenschaften) {
  const status = STATUS[termin.status]
  const ort = termin.ort?.trim()
  const uhrzeit = uhrzeitKurz(termin.uhrzeit)
  const mitZusagen = termin.status !== 'ABGESAGT'

  return (
    <Link
      to={ADMIN_PFADE.terminVerwaltung(termin.terminId)}
      className={style.zeile}
      data-testid={`admin-termin-zeile-${String(termin.terminId)}`}
    >
      <span className={style.zeit}>
        <span className={style.datum}>
          <span aria-hidden="true">
            {datumListe(termin.datum)} · {uhrzeit} Uhr
          </span>
          <span className="nurFuerScreenreader">
            {datumLang(termin.datum)}, {uhrzeit} Uhr
          </span>
        </span>
        {ort && <span className={style.ort}>{ort}</span>}
      </span>
      <span className={style.stand}>
        <span className={style.status} data-testid={`admin-termin-status-${String(termin.terminId)}`}>
          <Icon name={status.symbol} />
          <span>{status.text}</span>
        </span>
        {mitZusagen && (
          <span className={style.zusagen} data-testid={`admin-termin-zusagen-${String(termin.terminId)}`}>
            {termin.zusagen === 1 ? '1 Zusage' : `${String(termin.zusagen)} Zusagen`}
          </span>
        )}
        {termin.serieId !== null && termin.serieId !== undefined && (
          <span className={style.serie} data-testid={`admin-termin-serie-${String(termin.terminId)}`}>
            Serie
          </span>
        )}
      </span>
    </Link>
  )
}

