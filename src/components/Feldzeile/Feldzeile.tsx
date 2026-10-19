import type { ReactNode } from 'react'
import style from './Feldzeile.module.scss'

/** Eigenschaften der Feldzeile. */
type FeldzeileEigenschaften = {
  /** Die Felder der Zeile, jedes mit eigener Beschriftung. */
  children: ReactNode
  /**
   * Spaltenbreiten als Wert für `grid-template-columns`, z. B. `1fr 1fr` oder `1fr 7.5rem`.
   * Vorgabe: gleich breite Spalten.
   */
  spalten?: string
  /**
   * Setzt die Felder untereinander. Gedacht für den Fehlerfall: Ein Fehlertext in einer halben Spalte bräche in
   * viele kurze Zeilen um; über die volle Breite ist er lesbar.
   */
  gestapelt?: boolean
  /** Test-ID der Zeile. */
  'data-testid'?: string
}

/**
 * Setzt zwei Felder nebeneinander (Prototyp 10b/10c): Startdatum und Enddatum, Datum und Uhrzeit, Uhrzeit und Ort.
 *
 * Ein Raster mit fester Spaltenzahl und `min-inline-size: 0` an den Zellen, damit ein breites Feld die Zeile nicht
 * über den Bildschirmrand schiebt (Safari, vgl. `PinFeld`). Die Spalten bleiben auch auf dem schmalen Telefon
 * nebeneinander; die Felder sind dafür kurz genug (Datum, Uhrzeit). Trägt eines einen Fehlertext, stapelt der
 * Aufrufer die Zeile (`gestapelt`).
 */
export default function Feldzeile({
  children,
  spalten = '1fr 1fr',
  gestapelt = false,
  'data-testid': testId,
}: FeldzeileEigenschaften) {
  return (
    <div className={style.zeile} style={{ gridTemplateColumns: gestapelt ? '1fr' : spalten }} data-testid={testId}>
      {children}
    </div>
  )
}
