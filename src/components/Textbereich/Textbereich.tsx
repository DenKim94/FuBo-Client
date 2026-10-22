import { useId, type Ref, type TextareaHTMLAttributes } from 'react'
import style from './Textbereich.module.scss'

/** Eigenschaften des mehrzeiligen Eingabefelds. */
export type TextbereichEigenschaften = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  /** Sichtbare Beschriftung; zugleich der Name des Feldes für Screenreader. */
  beschriftung: string
  /** Dauerhafter Hilfetext unter dem Feld. */
  hinweis?: string
  /** Fehlertext; macht das Feld als ungültig kenntlich. */
  fehler?: string | null
  /** Id eines Elements, das das Feld zusätzlich beschreibt; folgt auf Hinweis und Fehler. */
  beschriebenDurch?: string
  /** Test-ID des Eingabeelements; der Fehler heißt `<test-id>-fehler`. */
  'data-testid'?: string
  /** React 19 reicht `ref` als gewöhnliche Eigenschaft durch (Fokus nach einem Fehler). */
  ref?: Ref<HTMLTextAreaElement>
}

/**
 * Beschriftetes mehrzeiliges Eingabefeld mit Hinweis und Fehlertext (C8, 9.2).
 *
 * Das Gegenstück zu {@link Feld} für Text mit Absätzen (die Vorlage der Hallenabsage): Beschriftung, Hinweis, Fehler
 * und ihre Verknüpfung sind dieselben (`aria-describedby`, `aria-invalid`), `Feld` kann kein `<textarea>`. Gleiche
 * Schrift (mindestens 16 px, sonst vergrößert iOS die Seite beim Fokussieren), gleicher bedienbarer Rand.
 * Die Höhe lässt sich nur senkrecht ziehen; die Breite gehört dem Layout.
 */
export default function Textbereich({
  beschriftung,
  hinweis,
  fehler,
  beschriebenDurch,
  className,
  rows = 5,
  'data-testid': testId = 'textbereich',
  ref,
  ...rest
}: TextbereichEigenschaften) {
  const id = useId()
  const hinweisId = `${id}-hinweis`
  const fehlerId = `${id}-fehler`
  const beschreibung = [hinweis && hinweisId, fehler && fehlerId, beschriebenDurch].filter(Boolean).join(' ')

  return (
    <div className={[style.feld, className].filter(Boolean).join(' ')}>
      <label className={style.beschriftung} htmlFor={id}>
        {beschriftung}
      </label>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
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
