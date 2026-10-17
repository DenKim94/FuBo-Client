import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Icon from '@/components/Icon/Icon'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import style from './CustomButton.module.scss'

/** Eigenschaften der Schaltfläche. */
type CustomButtonEigenschaften = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Gewicht der Aktion. `gefahr` ist für unwiderrufliche Schritte (z. B. Hallenabsage, A23). */
  art?: 'primaer' | 'sekundaer' | 'gefahr'
  /** Nimmt die volle Breite ein – der Normalfall in der Aktionsleiste. */
  breit?: boolean
  /**
   * Zeigt den Ladespinner mittig in der Schaltfläche und sperrt sie, solange ein
   * Aufruf läuft. Beschriftung und Symbol sind dann unsichtbar (siehe unten).
   */
  laedt?: boolean
  /**
   * Symbol links neben der Beschriftung: Dateiname in `public/icons/` ohne
   * Endung (SVG), z. B. `login_icon_dark`. Rein schmückend; den Namen trägt der Text.
   */
  symbol?: string
  /** Test-ID für die End-to-End-Tests; jede Schaltfläche braucht eine eigene. */
  'data-testid'?: string
  children: ReactNode
}

/** Kantenlänge des Symbols in rem (20 px), kleiner als das Standardsymbol, damit es zur Schrift passt. */
const SYMBOLGROESSE = 1.25

/**
 * Die Schaltfläche der Anwendung (C2, Abschnitt 7.1).
 *
 * `type` ist ausdrücklich mit `button` vorbelegt: Ohne Angabe ist eine
 * Schaltfläche im Formular ein Absenden-Knopf, und ein „Abbrechen" schickte
 * das Formular ab. Wer absenden will, setzt `type="submit"` selbst.
 *
 * **Im Ladezustand sitzt der Spinner allein in der Mitte.** Symbol und Beschriftung
 * bleiben im Layout (die Schaltfläche behält ihre Breite und springt nicht), sind
 * aber unsichtbar (`opacity: 0`). Bewusst nicht `visibility: hidden` oder
 * `display: none`: Beides nähme die Beschriftung aus dem Zugänglichkeitsbaum, und
 * die Schaltfläche hätte während des Ladens keinen Namen. Die Schaltfläche behält
 * dabei ihre Farbe – grau wird sie nur, wenn sie wirklich nicht verfügbar ist.
 * `aria-busy` meldet den Zustand an Screenreader; der Spinner selbst ist deshalb
 * nur Schmuck.
 */
export default function CustomButton({
  art = 'sekundaer',
  breit = false,
  laedt = false,
  symbol,
  disabled,
  type = 'button',
  className,
  children,
  'data-testid': testId = 'custom-button',
  ...rest
}: CustomButtonEigenschaften) {
  const klassen = [style.schaltflaeche, style[art], breit && style.breit, laedt && style.laedt, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={klassen}
      disabled={disabled || laedt}
      aria-busy={laedt || undefined}
      data-testid={testId}
      {...rest}
    >
      {laedt && (
        <span className={style.spinner}>
          <Ladespinner groesse="klein" farbe="erben" dekorativ verzoegert={false} />
        </span>
      )}
      <span className={style.inhalt}>
        {symbol && <Icon name={symbol} groesse={SYMBOLGROESSE} />}
        {children}
      </span>
    </button>
  )
}
