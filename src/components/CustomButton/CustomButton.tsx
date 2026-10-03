import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import style from './CustomButton.module.scss'

/** Eigenschaften der Schaltfläche. */
type CustomButtonEigenschaften = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Gewicht der Aktion. `gefahr` ist für unwiderrufliche Schritte (z. B. Hallenabsage, A23). */
  art?: 'primaer' | 'sekundaer' | 'gefahr'
  /** Nimmt die volle Breite ein – der Normalfall in der Aktionsleiste. */
  breit?: boolean
  /** Zeigt den Ladespinner und sperrt die Schaltfläche, solange ein Aufruf läuft. */
  laedt?: boolean
  /** Test-ID für die End-to-End-Tests; jede Schaltfläche braucht eine eigene. */
  'data-testid'?: string
  children: ReactNode
}

/**
 * Die Schaltfläche der Anwendung (C2, Abschnitt 7.1).
 *
 * `type` ist ausdrücklich mit `button` vorbelegt: Ohne Angabe ist eine
 * Schaltfläche im Formular ein Absenden-Knopf, und ein „Abbrechen" schickte
 * das Formular ab. Wer absenden will, setzt `type="submit"` selbst.
 *
 * Im Ladezustand bleibt die Beschriftung stehen, und der Spinner tritt davor:
 * Ein Austausch der Beschriftung änderte die Breite und liesse offen, was
 * gerade läuft. Die Schaltfläche behält dabei ihre Farbe – grau wird sie nur,
 * wenn sie wirklich nicht verfügbar ist. `aria-busy` meldet den Zustand an
 * Screenreader; der Spinner selbst ist deshalb nur Schmuck.
 */
export default function CustomButton({
  art = 'sekundaer',
  breit = false,
  laedt = false,
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
      {laedt && <Ladespinner groesse="klein" farbe="erben" dekorativ verzoegert={false} />}
      {children}
    </button>
  )
}
