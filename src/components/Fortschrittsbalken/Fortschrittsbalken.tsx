import type { CSSProperties } from 'react'
import style from './Fortschrittsbalken.module.scss'

/** Eigenschaften des Fortschrittsbalkens. */
type FortschrittsbalkenEigenschaften = {
  /** Aktuelle Zahl der Zusagen. */
  wert: number
  /** Mindestanzahl, gegen die gemessen wird (Vorgabe 6, A10). */
  ziel: number
  /**
   * Mindestanzahl erreicht – **vom Server** (`mindestzahlErreicht` der
   * Teilnehmerliste), nicht im Client nachgerechnet.
   */
  erreicht: boolean
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Zeigt den Stand der Zusagen gegen die Mindestanzahl (C2, Abschnitt 3; A10).
 *
 * **Kein `<progress>`:** Dessen Füllung lässt sich nur über herstellereigene
 * Pseudoelemente einfärben (`::-webkit-progress-value`, `::-moz-progress-bar`),
 * und die Farbe wechselt hier fachlich zwischen „noch zu wenige“ und „genug“.
 * Stattdessen ein `div` mit `role="progressbar"` und den ARIA-Werten.
 *
 * **Die Aussage hängt nicht an der Farbe:** Neben dem Balken steht „x von y
 * Zusagen“ und – solange die Mindestanzahl fehlt – ein Satz dazu.
 * `aria-valuetext` sagt dasselbe für Screenreader.
 *
 * Die Füllung ist bei Überschreiten des Ziels auf 100 % gedeckelt; die Zahl im
 * Text bleibt die echte.
 */
export default function Fortschrittsbalken({
  wert,
  ziel,
  erreicht,
  'data-testid': testId = 'fortschrittsbalken',
}: FortschrittsbalkenEigenschaften) {
  // `Math.max(ziel, 1)` verhindert eine Division durch null, falls die
  // Konfiguration eine Mindestanzahl von 0 liefert.
  const anteil = Math.min(100, Math.round((Math.max(wert, 0) / Math.max(ziel, 1)) * 100))
  const fuellungKlassen = [style.fuellung, erreicht ? style.erreicht : style.offen].join(' ')

  return (
    <div className={style.behaelter} data-testid={testId}>
      <div
        className={style.spur}
        role="progressbar"
        aria-valuenow={wert}
        aria-valuemin={0}
        aria-valuemax={ziel}
        aria-valuetext={`${wert} von ${ziel} Zusagen`}
        aria-label="Zusagen"
      >
        <div
          className={fuellungKlassen}
          style={{ '--fuellung-anteil': `${anteil}%` } as CSSProperties}
          data-erreicht={erreicht}
          data-testid={`${testId}-fuellung`}
        />
      </div>
      <p className={style.text} data-testid={`${testId}-text`}>
        <strong className={style.zahl}>{wert}</strong> von {ziel} Zusagen
        {!erreicht && ' – Mindestanzahl noch nicht erreicht'}
      </p>
    </div>
  )
}
