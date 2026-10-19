import type { ReactNode } from 'react'
import style from './Knopfgruppe.module.scss'

/** Eigenschaften der Knopfgruppe. */
type KnopfgruppeEigenschaften = {
  /** Die Schaltflächen der Gruppe. Bedingte Schaltflächen (`false`, `null`) belegen keine Spalte. */
  children: ReactNode
  /** Setzt die Schaltflächen untereinander statt nebeneinander (Dialoge, Abschnitte mit mehreren Aktionen). */
  untereinander?: boolean
  /** Zusätzliche Klasse des Aufrufers, etwa für Abstände zum Inhalt darüber. */
  className?: string
  /** Test-ID der Gruppe. */
  'data-testid'?: string
}

/**
 * Setzt zwei oder mehr Schaltflächen nebeneinander oder untereinander, **immer gleich breit**.
 *
 * Gleich breit, weil verschieden lange Beschriftungen („Abbrechen“, „Speichern“) sonst verschieden breite Knöpfe
 * ergeben und die Leiste unruhig wirkt (Vorgabe des Entwicklers vom 18.10.2026). Ein Raster statt `flex: 1`:
 * Flex verteilt nur den **freien** Platz, die Mindestbreite des Inhalts bleibt je Knopf verschieden. Das Raster mit
 * `minmax(0, 1fr)` teilt die ganze Breite; eine lange Beschriftung bricht um, statt den Nachbarn zu verdrängen.
 *
 * Untereinander nehmen alle Knöpfe die volle Breite der Gruppe ein und sind damit ebenfalls gleich breit.
 */
export default function Knopfgruppe({ children, untereinander = false, className, 'data-testid': testId }: KnopfgruppeEigenschaften) {
  const klassen = [style.gruppe, untereinander ? style.untereinander : style.nebeneinander, className].filter(Boolean).join(' ')
  return (
    <div className={klassen} data-testid={testId}>
      {children}
    </div>
  )
}
