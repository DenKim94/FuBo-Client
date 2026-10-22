import { useId, type Ref } from 'react'
import style from './Haken.module.scss'

/** Eigenschaften des Hakens. */
type HakenEigenschaften = {
  /** Sichtbare Beschriftung; zugleich der Name des Kontrollkästchens. */
  beschriftung: string
  /** Aktueller Zustand. */
  angehakt: boolean
  /** Wird mit dem **neuen** Zustand aufgerufen. */
  beiAenderung: (angehakt: boolean) => void
  /** Erklärt, was der Haken bewirkt; der Screenreader liest es mit. */
  hinweis?: string
  /** Sperrt das Feld, solange gesendet wird. Kein `disabled`: Der Fokus bleibt. */
  schreibgeschuetzt?: boolean
  /** Test-ID des Kontrollkästchens; der Hinweis heißt `<test-id>-text`. */
  'data-testid'?: string
  /** Zugriff auf das Kontrollkästchen (Fokus auf das erste fehlerhafte Feld). */
  ref?: Ref<HTMLInputElement>
}

/**
 * Kontrollkästchen mit Beschriftung und Hinweis (C8, 9.2) für eine Wahl, die **erst mit dem Speichern des Formulars**
 * gilt (Hallenmodus, Push-Versand).
 *
 * **Abgrenzung zu {@link Schalter}:** Ein Schalter wirkt beim Umlegen, ein Haken beim Absenden. Wer beides vermischt,
 * lässt die Person raten, ob „an“ schon gilt. Die ganze Zeile ist die Beschriftung und das Tap-Ziel (A2). Der Zustand
 * steht nie allein in der Farbe: Das Kästchen ist gefüllt und `checked`.
 */
export default function Haken({
  beschriftung,
  angehakt,
  beiAenderung,
  hinweis,
  schreibgeschuetzt = false,
  'data-testid': testId = 'haken',
  ref,
}: HakenEigenschaften) {
  const hinweisId = useId()
  return (
    <div className={style.haken}>
      <label className={style.zeile}>
        <input
          ref={ref}
          type="checkbox"
          checked={angehakt}
          aria-describedby={hinweis ? hinweisId : undefined}
          aria-readonly={schreibgeschuetzt || undefined}
          onChange={(e) => {
            if (!schreibgeschuetzt) beiAenderung(e.target.checked)
          }}
          data-testid={testId}
        />
        <span>{beschriftung}</span>
      </label>
      {hinweis && (
        <p id={hinweisId} className={style.hinweis} data-testid={`${testId}-text`}>
          {hinweis}
        </p>
      )}
    </div>
  )
}
