import type { ReactNode } from 'react'
import Icon from '@/components/Icon/Icon'
import style from './Fehlermeldung.module.scss'

/** Eigenschaften der Fehlermeldung. */
type FehlermeldungEigenschaften = {
  /** Der Text – meist aus `fehlertextBilden`, sonst eigene Worte der Ansicht. */
  children: ReactNode
  /** Für `aria-describedby` eines Feldes, auf das sich die Meldung bezieht. */
  id?: string
  /** Test-ID; jede Ansicht vergibt ihre eigene. */
  'data-testid'?: string
}

/**
 * Fehlerkasten unter einem Formular (C2, Abschnitt 5.1).
 *
 * **Abgrenzung zu `Fehlerzustand`:** Die Meldung steht *neben* einer
 * bedienbaren Ansicht – eine abgelehnte PIN, ein belegter Name –, und die
 * Ansicht bleibt nutzbar. `Fehlerzustand` *ersetzt* den Inhalt, weil ohne die
 * geladenen Daten nichts zu bedienen ist.
 *
 * Der Text kommt vom Aufrufer, nicht aus einem Fehlerobjekt: Manche Meldungen
 * entstehen ohne Aufruf („… ist bereits angemeldet“, aus dem Polling-Stand).
 * `role="alert"` liest die Meldung beim Erscheinen vor, ohne den Fokus zu
 * verschieben. Das Symbol trägt die Aussage nur mit; sie steht im Text.
 */
export default function Fehlermeldung({ children, id, 'data-testid': testId = 'fehlermeldung' }: FehlermeldungEigenschaften) {
  return (
    <p className={style.meldung} id={id} role="alert" data-testid={testId}>
      <Icon name="error_circle_icon" />
      <span>{children}</span>
    </p>
  )
}
