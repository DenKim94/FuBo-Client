import { PASSWORT_MAX_LAENGE, PASSWORT_MIN_LAENGE } from '@/api/auth/passwortRegeln'
import Icon from '@/components/Icon/Icon'
import style from './PasswortRegeln.module.scss'

/** Eigenschaften der Regelliste. */
type PasswortRegelnEigenschaften = {
  /** Das Passwort, gegen das geprüft wird. */
  passwort: string
  /** Id der Liste; das Passwortfeld verweist per `aria-describedby` darauf. */
  id?: string
  /** Test-ID der Liste; jede Regel erhält sie mit `-mindestens` bzw. `-hoechstens`. */
  'data-testid'?: string
}

/**
 * Zeigt die Regeln für ein neues Passwort mit ihrem Stand (C4, 5.4).
 *
 * **Icon und Text je Regel, nicht nur Farbe** (DESIGN.md): Eine erfüllte Regel
 * trägt einen Haken, eine offene ein Kreuz in der Kreisform; das Symbol hat
 * einen Text („Erfüllt:“ / „Noch offen:“), den Screenreader vor der Regel lesen.
 * Die Farbe verstärkt nur.
 *
 * **Nur zwei Regeln, wie der Kontrakt sie kennt:** mindestens 10 Zeichen und –
 * erst wenn überschritten – höchstens 72. Keine Zeichenklassen („Ziffer
 * enthalten“ aus dem Prototyp entfällt): Der Server verlangt sie nicht, und
 * eine Regel, die er nicht hat, lehnte gültige Passwörter ab.
 *
 * **Keine Live-Region:** Die Liste wird nicht bei jedem Zeichen vorgelesen. Sie
 * ist mit dem Feld verknüpft und wird beim Fokussieren als Beschreibung
 * gelesen.
 */
export default function PasswortRegeln({
  passwort,
  id,
  'data-testid': testId = 'passwort-regeln',
}: PasswortRegelnEigenschaften) {
  const mindestensErfuellt = passwort.length >= PASSWORT_MIN_LAENGE
  const zuLang = passwort.length > PASSWORT_MAX_LAENGE

  return (
    <ul className={style.liste} id={id} data-testid={testId}>
      <Regel
        erfuellt={mindestensErfuellt}
        text={`mindestens ${PASSWORT_MIN_LAENGE} Zeichen`}
        data-testid={`${testId}-mindestens`}
      />
      {zuLang && (
        <Regel
          erfuellt={false}
          text={`höchstens ${PASSWORT_MAX_LAENGE} Zeichen`}
          data-testid={`${testId}-hoechstens`}
        />
      )}
    </ul>
  )
}

/** Eine Zeile der Liste. */
function Regel({
  erfuellt,
  text,
  'data-testid': testId,
}: {
  erfuellt: boolean
  text: string
  'data-testid': string
}) {
  return (
    <li
      className={[style.regel, erfuellt ? style.erfuellt : style.offen].join(' ')}
      data-erfuellt={erfuellt}
      data-testid={testId}
    >
      <Icon
        name={erfuellt ? 'check_circle_icon' : 'cancel_circle_icon_red'}
        groesse={1.25}
        beschriftung={erfuellt ? 'Erfüllt:' : 'Noch offen:'}
      />
      <span>{text}</span>
    </li>
  )
}
