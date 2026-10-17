import type { ReactNode } from 'react'
import Icon from '@/components/Icon/Icon'
import style from './Hinweis.module.scss'

/** Eigenschaften des Hinweises. */
type HinweisEigenschaften = {
  children: ReactNode
  /** Test-ID; jede Ansicht vergibt ihre eigene. */
  'data-testid'?: string
}

/**
 * Neutraler Hinweis in einer Ansicht (C4, 5.5): etwas ist geschehen, nichts ist
 * schiefgelaufen – „Passwort gesetzt. Melde dich mit dem neuen Passwort an.“
 *
 * **Abgrenzung zu `Fehlermeldung`:** kein Fehler, deshalb kein `role="alert"`
 * (das unterbräche den Screenreader) und kein Rot. `role="status"` meldet den
 * Text höflich, ohne den Fokus zu verschieben. Die Aussage steht im Text; das
 * Symbol trägt sie nur mit.
 */
export default function Hinweis({ children, 'data-testid': testId = 'hinweis' }: HinweisEigenschaften) {
  return (
    <p className={style.hinweis} role="status" data-testid={testId}>
      <span className={style.symbol}>
        <Icon name="info_circle_icon" />
      </span>
      <span className={style.text}>{children}</span>
    </p>
  )
}
