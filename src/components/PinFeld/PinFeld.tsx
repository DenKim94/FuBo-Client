import { useId, type ChangeEvent, type CSSProperties, type Ref } from 'react'
import style from './PinFeld.module.scss'

/** Eigenschaften des PIN-Feldes. */
type PinFeldEigenschaften = {
  /** Zahl der Kästchen und zugleich die größte Länge der Eingabe. */
  stellen: number
  wert: string
  beiAenderung: (wert: string) => void
  /** Sichtbare Beschriftung; zugleich der Name des Feldes für Screenreader. */
  beschriftung: string
  /** Dauerhafter Hilfetext unter dem Feld. */
  hinweis?: string
  /** Fehlertext am Feld; macht es als ungültig kenntlich. */
  fehler?: string | null
  /** Markiert das Feld als ungültig, ohne eigenen Text (die Ansicht zeigt den Kasten selbst). */
  fehlerhaft?: boolean
  /** Id eines Elements außerhalb, das den Fehler beschreibt; wird nur bei einem Fehler verknüpft. */
  beschriebenDurch?: string
  /** Vorgabe `off`; für Codes aus einer E-Mail oder SMS `one-time-code`. */
  autoComplete?: string
  /** Nur Ziffern übernehmen (Vorgabe). Die zentrale PIN lässt das aus, siehe `PinEingabe`. */
  nurZiffern?: boolean
  /** Nur lesbar statt gesperrt: `disabled` nähme dem Feld den Fokus. */
  readOnly?: boolean
  /** Beschriftung und Hinweis mittig (Vorgabe) oder am Zeilenanfang (in Formularen mit weiteren Feldern). */
  ausrichtung?: 'mitte' | 'start'
  /** Präfix der Test-IDs: `<präfix>-feld` am Eingabeelement, `<präfix>-kasten` an jedem Kästchen. */
  testIdPraefix?: string
  /** React 19 reicht `ref` als gewöhnliche Eigenschaft durch. */
  ref?: Ref<HTMLInputElement>
}

/**
 * PIN-Eingabe mit Kästchen (Screen 01 der Prototypen).
 *
 * Aus `PinEingabe` herausgelöst (C4, 5.2): Die zentrale PIN hat vier Stellen,
 * die Bestätigungs-PIN aus der E-Mail fünf.
 *
 * **Ein echtes Eingabefeld unter den Kästchen.** Die Kästchen sind nur
 * Darstellung; darüber liegt ein durchsichtiges, natives `<input>` mit
 * `inputMode="numeric"`. Ein Tipp darauf öffnet die Zifferntastatur des Geräts –
 * kein nachgebauter Ziffernblock, der Tastatur, Screenreader, Einfügen und
 * Autofill erst nachbilden müsste.
 *
 * **Kästchen im CSS-Raster mit fester Spaltenzahl**, nicht als umbrechende
 * Flex-Zeile: Safari stellte die Kästchen mit `fit-content` untereinander (C3).
 *
 * Die Eingabe ist auf `stellen` Zeichen begrenzt. Ein eingefügter Text wird vom
 * Browser auf diese Länge gekürzt, **bevor** Nicht-Ziffern entfernt werden – ein
 * Code mit Leerzeichen („123 45“) käme also verkürzt an. Der Code in der
 * E-Mail steht ohne Trennzeichen.
 */
export default function PinFeld({
  stellen,
  wert,
  beiAenderung,
  beschriftung,
  hinweis,
  fehler,
  fehlerhaft = false,
  beschriebenDurch,
  autoComplete = 'off',
  nurZiffern = true,
  readOnly,
  ausrichtung = 'mitte',
  testIdPraefix = 'pin',
  ref,
}: PinFeldEigenschaften) {
  const id = useId()
  const hinweisId = `${id}-hinweis`
  const fehlerId = `${id}-fehler`
  const ungueltig = fehlerhaft || Boolean(fehler)
  const beschreibung = [hinweis && hinweisId, fehler && fehlerId, ungueltig && beschriebenDurch]
    .filter(Boolean)
    .join(' ')

  function geaendert(ereignis: ChangeEvent<HTMLInputElement>) {
    const eingabe = ereignis.target.value
    beiAenderung(nurZiffern ? eingabe.replace(/\D/g, '') : eingabe)
  }

  const felderKlassen = [style.felder, ungueltig && wert === '' && style.fehlerhaft]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={[style.pinFeld, style[ausrichtung]].join(' ')}>
      <label className={style.beschriftung} htmlFor={id}>
        {beschriftung}
      </label>

      <div className={felderKlassen}>
        <div
          className={style.kaestchen}
          style={{ '--kaestchen-anzahl': stellen } as CSSProperties}
          aria-hidden="true"
        >
          {Array.from({ length: stellen }, (_, i) => (
            <span
              key={i}
              className={[
                style.kasten,
                i < wert.length && style.gefuellt,
                i === wert.length && style.naechstes,
              ]
                .filter(Boolean)
                .join(' ')}
              data-gefuellt={i < wert.length}
              data-testid={`${testIdPraefix}-kasten`}
            />
          ))}
        </div>
        <input
          ref={ref}
          id={id}
          className={style.eingabe}
          type="text"
          // Öffnet die Zifferntastatur, ohne die Eingabe auf Ziffern zu zwingen
          // (das regelt `nurZiffern` im Änderungsereignis).
          inputMode="numeric"
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={stellen}
          value={wert}
          onChange={geaendert}
          // Während der Prüfung nur lesbar statt gesperrt: `disabled` nähme
          // dem Feld den Fokus und schlösse auf dem Telefon die Tastatur.
          readOnly={readOnly}
          aria-invalid={ungueltig || undefined}
          aria-describedby={beschreibung || undefined}
          data-testid={`${testIdPraefix}-feld`}
        />
      </div>

      {hinweis && (
        <p className={style.hinweis} id={hinweisId}>
          {hinweis}
        </p>
      )}
      {fehler && (
        <p className={style.fehler} id={fehlerId} data-testid={`${testIdPraefix}-feld-fehler`}>
          {fehler}
        </p>
      )}
    </div>
  )
}
