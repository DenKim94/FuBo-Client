import { useId, type InputHTMLAttributes } from 'react'
import style from './Feld.module.scss'

/** Eigenschaften des Eingabefelds. */
type FeldEigenschaften = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  /** Sichtbare Beschriftung; zugleich der Name des Feldes für Screenreader. */
  beschriftung: string
  /** Dauerhafter Hilfetext unter dem Feld, z. B. eine Längenangabe. */
  hinweis?: string
  /** Fehlertext; macht das Feld als ungültig kenntlich. */
  fehler?: string | null
  /** Test-ID des Eingabeelements. */
  'data-testid'?: string
}

/**
 * Beschriftetes Eingabefeld mit Hinweis und Fehlertext (C2, Abschnitt 7.2).
 *
 * Ein Feld ist nie nur ein Feld: Beschriftung, Hinweis, Fehler und ihre
 * Verknüpfung gehören zusammen und werden sonst in jeder Ansicht neu vergessen.
 * `useId` erzeugt eindeutige Bezeichner, auch wenn eine Ansicht das Feld
 * mehrfach zeigt. `aria-describedby` verweist auf Hinweis und Fehler,
 * `aria-invalid` sagt, dass es einen Fehler gibt – ein roter Rahmen allein
 * sagte es nur den Sehenden.
 */
export default function Feld({
  beschriftung,
  hinweis,
  fehler,
  className,
  'data-testid': testId = 'feld-eingabe',
  ...rest
}: FeldEigenschaften) {
  const id = useId()
  const hinweisId = `${id}-hinweis`
  const fehlerId = `${id}-fehler`
  const beschreibung = [hinweis && hinweisId, fehler && fehlerId].filter(Boolean).join(' ')

  return (
    <div className={[style.feld, className].filter(Boolean).join(' ')}>
      <label className={style.beschriftung} htmlFor={id}>
        {beschriftung}
      </label>
      <input
        id={id}
        className={[style.eingabe, fehler && style.ungueltig].filter(Boolean).join(' ')}
        aria-invalid={fehler ? true : undefined}
        aria-describedby={beschreibung || undefined}
        data-testid={testId}
        {...rest}
      />
      {hinweis && (
        <p className={style.hinweis} id={hinweisId}>
          {hinweis}
        </p>
      )}
      {fehler && (
        <p className={style.fehler} id={fehlerId} data-testid={`${testId}-fehler`}>
          {fehler}
        </p>
      )}
    </div>
  )
}
