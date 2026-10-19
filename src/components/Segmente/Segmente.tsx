import { useId, type ReactNode } from 'react'
import style from './Segmente.module.scss'

/** Eine Option der Segmentgruppe. */
export type SegmentOption = {
  /** Wert, den die Gruppe meldet; zugleich der Rest der Test-ID. */
  wert: string
  /** Sichtbarer Text im Segment, kurz: „Mo“, „3“, „Serie“. */
  text: string
  /** Voller Name für Screenreader, wenn der sichtbare Text eine Kurzform ist („Montag“). */
  lesetext?: string
}

/** Eigenschaften der Segmentgruppe. */
type SegmenteEigenschaften = {
  /** Beschriftung der Gruppe (`<legend>`); darf mehr als Text sein, etwa Name und aktueller Wert in einer Zeile. */
  legende: ReactNode
  /** Blendet die Legende aus, ohne sie dem Screenreader zu nehmen (die Gruppe erklärt sich dann selbst). */
  legendeVersteckt?: boolean
  /** Die Optionen in Anzeigereihenfolge. */
  optionen: readonly SegmentOption[]
  /** Gewählter Wert; `''` heisst: nichts gewählt (kein Segment ist vorbelegt). */
  wert: string
  /** Meldet die Wahl. */
  beiAenderung: (wert: string) => void
  /** Sperrt die Wahl, solange gesendet wird. Kein `disabled`: Der Fokus bleibt im Segment. */
  schreibgeschuetzt?: boolean
  /** Dauerhafter Hilfetext unter der Gruppe. */
  hinweis?: string
  /** Fehlertext; macht die Gruppe als ungültig kenntlich. */
  fehler?: string | null
  /** Test-ID der Gruppe; das Segment mit dem Wert `x` heisst `<test-id>-x`. */
  'data-testid'?: string
}

/**
 * Segmentierte Auswahl: genau ein Wert aus wenigen, auf einen Blick sichtbaren Möglichkeiten
 * (Art des Termins, Wochentag, Skillstufe).
 *
 * **Eine Radiogruppe, kein Slider und kein Menü** (Prototyp 09b: „Stufen als Segmente statt Slider:
 * treffsicher, Wert immer als Zahl lesbar“). Native `<input type="radio">` liefern Gruppe, Pfeiltasten und
 * Zustand für Screenreader ohne eigenen Code; das Segment ist die Beschriftung und damit das Tap-Ziel.
 * Die Auswahl hängt nie allein an der Farbe: Das gewählte Segment ist gefüllt **und** `checked`; Aufrufer,
 * für die der Wert wichtig ist, nennen ihn zusätzlich als Text in der Legende.
 *
 * **Keine Vorauswahl** ist erlaubt (`wert=""`): Dann ist kein Segment gewählt, und der Aufrufer erklärt,
 * warum er nicht weitermacht. Das Segment ist mindestens 44 px hoch; die Breite teilen sich alle Segmente,
 * die Lücke ist klein gehalten, damit sieben Segmente bei 360 px noch 44 px breit sind.
 */
export default function Segmente({
  legende,
  legendeVersteckt = false,
  optionen,
  wert,
  beiAenderung,
  schreibgeschuetzt = false,
  hinweis,
  fehler,
  'data-testid': testId = 'segmente',
}: SegmenteEigenschaften) {
  const id = useId()
  const hinweisId = `${id}-hinweis`
  const fehlerId = `${id}-fehler`
  const beschreibung = [hinweis && hinweisId, fehler && fehlerId].filter(Boolean).join(' ')

  return (
    <fieldset
      className={style.gruppe}
      aria-describedby={beschreibung || undefined}
      aria-invalid={fehler ? true : undefined}
      data-testid={testId}
    >
      {/* Versteckt nur die globale Klasse, ohne `style.legende`: Beide setzen die Breite, und welche gewinnt, hinge an
          der Reihenfolge der Stylesheets. Seit dem Nachladen des Admin-Bereichs steht dieses Modul nach `global.scss`;
          die volle Breite der Legende ragte dann 16 px über den Rand (E2E, 18.10.2026). */}
      <legend className={legendeVersteckt ? 'nurFuerScreenreader' : style.legende}>
        {legende}
      </legend>
      <div className={style.reihe}>
        {optionen.map((option) => (
          <label key={option.wert} className={style.segment}>
            <input
              type="radio"
              name={id}
              value={option.wert}
              className={style.eingabe}
              checked={wert === option.wert}
              onChange={() => {
                if (!schreibgeschuetzt) beiAenderung(option.wert)
              }}
              data-testid={`${testId}-${option.wert}`}
            />
            <span className={style.text} aria-hidden={option.lesetext ? true : undefined}>
              {option.text}
            </span>
            {option.lesetext && <span className="nurFuerScreenreader">{option.lesetext}</span>}
          </label>
        ))}
      </div>
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
    </fieldset>
  )
}
