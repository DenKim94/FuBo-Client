import { Link, type LinkProps } from 'react-router'
import style from './Textlink.module.scss'

/** Eigenschaften des Textlinks: die des Router-Links, die Test-ID ist Pflicht. */
type TextlinkEigenschaften = Omit<LinkProps, 'className'> & {
  'data-testid': string
}

/**
 * Nachrangiger Verweis als unterstrichener Text, etwa „Als Admin anmelden“ oder
 * „Passwort vergessen?“ (C4).
 *
 * Ein Link ist hier keine Schaltfläche: Er führt zu einer anderen Ansicht, und
 * die Hauptaktion der Ansicht bleibt die Schaltfläche in der Aktionsleiste. Das
 * Tap-Ziel ist trotzdem `--tapziel-min` hoch (A2: einhändig, draußen), die
 * Farbe `--farbe-link` ist 6,76:1 auf Weiß.
 */
export default function Textlink({ children, ...rest }: TextlinkEigenschaften) {
  return (
    <Link className={style.textlink} {...rest}>
      {children}
    </Link>
  )
}
