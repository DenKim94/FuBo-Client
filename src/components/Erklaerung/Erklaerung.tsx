import { useId, useState } from 'react'
import Icon from '@/components/Icon/Icon'
import style from './Erklaerung.module.scss'

/** Eigenschaften der Erklärung. */
type ErklaerungEigenschaften = {
  /** Der erklärende Text, der ein- und ausgeblendet wird. */
  text: string
  /** Name der Schaltfläche für Screenreader. */
  beschriftung?: string
  /** Test-ID der Schaltfläche; der Text erhält dieselbe mit `-text`. */
  'data-testid'?: string
}

/**
 * Info-Symbol, das einen erklärenden Text ein- und ausblendet (C2, Abschnitt 7.5; A8).
 *
 * Ein Umschalter statt eines Tooltips: Auf Touchgeräten gibt es kein Hover,
 * und ein `title`-Attribut wird dort nie angezeigt. `aria-expanded` macht den
 * Zustand hörbar. Der Text steht auch eingeklappt im Baum (`hidden`), damit
 * `aria-controls` immer auf ein vorhandenes Element zeigt.
 */
export default function Erklaerung({
  text,
  beschriftung = 'Erklärung anzeigen',
  'data-testid': testId = 'erklaerung',
}: ErklaerungEigenschaften) {
  const [offen, setOffen] = useState(false)
  const id = useId()

  return (
    <div className={style.erklaerung}>
      <button
        type="button"
        className={style.schalter}
        aria-expanded={offen}
        aria-controls={id}
        aria-label={beschriftung}
        onClick={() => setOffen((zustand) => !zustand)}
        data-testid={testId}
      >
        <Icon name="info_circle_icon" />
      </button>
      <p className={style.text} id={id} hidden={!offen} data-testid={`${testId}-text`}>
        {text}
      </p>
    </div>
  )
}
