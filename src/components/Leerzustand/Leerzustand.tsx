import type { ReactNode } from 'react'
import Icon from '@/components/Icon/Icon'
import style from './Leerzustand.module.scss'

/** Eigenschaften des Leerzustands. */
type LeerzustandEigenschaften = {
  /** Was fehlt, kurz: „Noch keine Zusagen“. */
  titel: string
  /** Grund oder nächster Schritt: „Sei der Erste.“ */
  text: string
  /** Optionale Aktion, in der Regel eine `CustomButton`. */
  aktion?: ReactNode
  /** Optionales Symbol aus `public/icons/` über dem Titel (schmückend). */
  icon?: string
  /**
   * Ebene der Überschrift. Vorgabe 2: Der Leerzustand steht meist unter der
   * Überschrift einer Ansicht. Füllt er die Ansicht allein, ist es die 1.
   */
  titelEbene?: 1 | 2
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Leerzustand einer Ansicht oder Liste (C2, Abschnitt 5.2).
 *
 * **Trägt immer Grund und nächsten Schritt**, nie nur „Keine Daten“: Eine leere
 * Fläche lässt offen, ob noch geladen wird, etwas kaputt ist oder es wirklich
 * nichts gibt. Deshalb sind `titel` und `text` Pflicht. Die fachlichen Texte
 * kommen aus den Paketen C5 bis C8.
 *
 * Ohne `role`: Ein Leerzustand ist ein Ergebnis, kein Ereignis, und soll nicht
 * wie ein Fehler vorgelesen werden.
 */
export default function Leerzustand({
  titel,
  text,
  aktion,
  icon,
  titelEbene = 2,
  'data-testid': testId = 'leerzustand',
}: LeerzustandEigenschaften) {
  const Ueberschrift = titelEbene === 1 ? 'h1' : 'h2'

  return (
    <div className={style.zustand} data-testid={testId}>
      {icon && (
        <span className={style.symbol}>
          <Icon name={icon} groesse={2.5} />
        </span>
      )}
      <Ueberschrift className={style.titel}>{titel}</Ueberschrift>
      <p className={style.text}>{text}</p>
      {aktion && <div className={style.aktion}>{aktion}</div>}
    </div>
  )
}
