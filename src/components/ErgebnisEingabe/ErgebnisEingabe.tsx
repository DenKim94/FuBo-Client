import { useId } from 'react'
import type { Sieger } from '@/api/ergebnis/ergebnis'
import style from './ErgebnisEingabe.module.scss'

/** Der Stand der Eingabe: Ausgang (`null` = noch nichts gewählt) und „deutlich“. */
export type ErgebnisWahl = {
  sieger: Sieger | null
  deutlich: boolean
}

/** Eigenschaften der Ergebniseingabe. */
type ErgebnisEingabeEigenschaften = ErgebnisWahl & {
  /** Meldet den neuen Stand; bei „Unentschieden“ ist `deutlich` bereits zurückgesetzt. */
  beiAenderung: (wahl: ErgebnisWahl) => void
  /** Sperrt beide Eingaben, solange gesendet wird. */
  deaktiviert?: boolean
}

/** Die drei Ausgänge in der Reihenfolge der Anzeige. */
const AUSGAENGE: { wert: Sieger; text: string; testId: string }[] = [
  { wert: 'A', text: 'Team A', testId: 'ergebnis-sieger-a' },
  { wert: 'B', text: 'Team B', testId: 'ergebnis-sieger-b' },
  { wert: 'U', text: 'Unentschieden', testId: 'ergebnis-sieger-u' },
]

/**
 * Die Eingabe eines Ergebnisses: „Wer hat gewonnen?“ und „Deutlicher Sieg“ (A21, C8 5.9).
 *
 * Aus `ErgebnisFormular` herausgelöst, weil zwei Stellen dieselbe Eingabe brauchen: das Eintragen durch die Spieler und
 * die Korrektur durch den Admin. **Kontrolliert** – der Zustand gehört dem Aufrufer, der daran auch seine Schaltfläche
 * hängt.
 *
 * **„Deutlicher Sieg“ gibt es nur bei einem Sieg.** Bei „Unentschieden“ ist der Haken gesperrt und wird zurückgesetzt, der
 * Grund steht als Text (`ergebnis-deutlich-grund`) – `true` bei `U` ist am Server unzulässig (`400`). Die Funktion, die
 * sendet, schickt bei `U` ohnehin `false`; die Regel gilt hier **und** dort (zwei Schlösser).
 */
export default function ErgebnisEingabe({ sieger, deutlich, beiAenderung, deaktiviert = false }: ErgebnisEingabeEigenschaften) {
  const hinweisId = useId()
  const gruppe = useId()

  /** Wählt den Ausgang; „Unentschieden“ nimmt einen gesetzten Haken zurück. */
  function waehlen(neu: Sieger) {
    beiAenderung({ sieger: neu, deutlich: neu === 'U' ? false : deutlich })
  }

  return (
    <div className={style.eingabe} data-testid="ergebnis-eingabe">
      <fieldset className={style.gruppe}>
        <legend className={style.legende}>Wer hat gewonnen?</legend>
        {AUSGAENGE.map((ausgang) => (
          <label key={ausgang.wert} className={style.option}>
            <input
              type="radio"
              name={gruppe}
              value={ausgang.wert}
              checked={sieger === ausgang.wert}
              disabled={deaktiviert}
              onChange={() => {
                waehlen(ausgang.wert)
              }}
              data-testid={ausgang.testId}
            />
            <span>{ausgang.text}</span>
          </label>
        ))}
      </fieldset>

      <div className={style.deutlich}>
        <label className={style.option}>
          <input
            type="checkbox"
            checked={deutlich}
            disabled={sieger === 'U' || deaktiviert}
            onChange={(e) => {
              beiAenderung({ sieger, deutlich: e.target.checked })
            }}
            aria-describedby={sieger === 'U' ? hinweisId : undefined}
            data-testid="ergebnis-deutlich"
          />
          <span>Deutlicher Sieg (Tordifferenz ab 3)</span>
        </label>
        {sieger === 'U' && (
          <p id={hinweisId} className={style.nebentext} data-testid="ergebnis-deutlich-grund">
            Nur bei einem Sieg möglich.
          </p>
        )}
      </div>
    </div>
  )
}
