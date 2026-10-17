import { datumKurz, datumLang, uhrzeitKurz } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import Icon from '@/components/Icon/Icon'
import style from './TerminKarte.module.scss'

/** Eigenschaften der Terminkarte. */
type TerminKarteEigenschaften = {
  /** Die Angaben, die die Karte zeigt. */
  termin: Pick<TerminUebersicht, 'datum' | 'uhrzeit' | 'ort' | 'status'>
  /** Ebene der Überschrift: `h1` auf Dashboard und Termin-Ansicht, `h2` in Listen. */
  ebene?: 1 | 2
  /** Kleinere Schrift für die Köpfe der Tabs „Teams“ und „Ergebnisse“. */
  kompakt?: boolean
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Datum, Uhrzeit und Ort eines Termins samt Status (C5, 6.1).
 *
 * **Datum und Uhrzeit stehen in einem `<time>`-Block** und bilden die
 * Überschrift. Sichtbar steht die Kurzform („Di, 29. Juli · 19:00 Uhr“), ein
 * Screenreader liest die ausgeschriebene („Dienstag, 29. Juli, 19:00 Uhr“); die
 * Abkürzung „Di“ liefe sonst als Buchstaben.
 *
 * **Der Status hängt nicht an der Farbe:** „Abgesagt“ trägt Symbol und Text,
 * ebenso „Abgeschlossen“. Der Ort erscheint nur, wenn es einen gibt – kein
 * leerer Platzhalter für einen optionalen Wert.
 */
export default function TerminKarte({
  termin,
  ebene = 1,
  kompakt = false,
  'data-testid': testId = 'termin-karte',
}: TerminKarteEigenschaften) {
  const Ueberschrift = ebene === 1 ? 'h1' : 'h2'
  const uhrzeit = uhrzeitKurz(termin.uhrzeit)
  const ort = termin.ort?.trim()

  return (
    <div className={[style.karte, kompakt && style.kompakt].filter(Boolean).join(' ')} data-testid={testId}>
      <Ueberschrift className={style.titel}>
        <time dateTime={`${termin.datum}T${uhrzeit}`}>
          <span aria-hidden="true">
            {datumKurz(termin.datum)} · {uhrzeit} Uhr
          </span>
          <span className="nurFuerScreenreader">
            {datumLang(termin.datum)}, {uhrzeit} Uhr
          </span>
        </time>
      </Ueberschrift>

      {ort && (
        <p className={style.ort} data-testid={`${testId}-ort`}>
          {ort}
        </p>
      )}

      {termin.status === 'ABGESAGT' && (
        <p className={`${style.status} ${style.abgesagt}`} data-testid={`${testId}-status`}>
          <Icon name="block_icon_red" />
          <span>Abgesagt</span>
        </p>
      )}
      {termin.status === 'ABGESCHLOSSEN' && (
        <p className={style.status} data-testid={`${testId}-status`}>
          <Icon name="check_circle_icon" />
          <span>Abgeschlossen</span>
        </p>
      )}
    </div>
  )
}
