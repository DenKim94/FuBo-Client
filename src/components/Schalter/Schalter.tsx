import { useId } from 'react'
import style from './Schalter.module.scss'

/** Eigenschaften des Schalters. */
type SchalterEigenschaften = {
  /** Sichtbare Beschriftung; zugleich der Name des Schalters. */
  beschriftung: string
  /** Aktueller Zustand. */
  an: boolean
  /** Wird mit dem **neuen** Zustand aufgerufen. */
  beiUmschalten: (an: boolean) => void
  /** Ein Aufruf läuft: Der Schalter nimmt kein Antippen an, bleibt aber fokussierbar. */
  beschaeftigt?: boolean
  /** Erklärt den aktuellen Zustand in einem Satz; der Screenreader liest ihn mit. */
  erklaerung?: string
  /** Test-ID des Schalters; die Erklärung heisst `<test-id>-text`. */
  'data-testid'?: string
}

/**
 * Schalter für einen Zustand, der **sofort** gilt (Prototyp 09b: „Aktiv in der Auswahlliste“).
 *
 * Ein `<button role="switch">` mit `aria-checked`, kein Kontrollkästchen: Ein Schalter wirkt beim Umlegen,
 * ein Kontrollkästchen erst beim Absenden eines Formulars. Der Zustand steht **als Text** daneben (die
 * Erklärung), nie allein in der Farbe der Spur. `type="button"` ist gesetzt, damit er in einem Formular
 * nicht absendet. Die ganze Zeile ist das Tap-Ziel (mindestens 48 px).
 *
 * Während eines Aufrufs ist er `aria-disabled` statt `disabled`: Der Fokus bleibt, und ein zweites Antippen
 * wird ignoriert.
 */
export default function Schalter({
  beschriftung,
  an,
  beiUmschalten,
  beschaeftigt = false,
  erklaerung,
  'data-testid': testId = 'schalter',
}: SchalterEigenschaften) {
  const erklaerungId = useId()
  return (
    <div className={style.karte}>
      <button
        type="button"
        role="switch"
        aria-checked={an}
        aria-disabled={beschaeftigt ? true : undefined}
        aria-busy={beschaeftigt || undefined}
        aria-describedby={erklaerung ? erklaerungId : undefined}
        className={style.schalter}
        onClick={() => {
          if (!beschaeftigt) beiUmschalten(!an)
        }}
        data-testid={testId}
      >
        <span className={style.beschriftung}>{beschriftung}</span>
        <span className={[style.spur, an && style.spurAn].filter(Boolean).join(' ')} aria-hidden="true">
          <span className={style.knopf} />
        </span>
      </button>
      {erklaerung && (
        <p id={erklaerungId} className={style.erklaerung} data-testid={`${testId}-text`}>
          {erklaerung}
        </p>
      )}
    </div>
  )
}
