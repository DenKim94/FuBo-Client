import type { Ref } from 'react'
import type { Ergebnis } from '@/api/ergebnis/ergebnis'
import { ergebnisSatz } from '@/api/ergebnis/ergebnisText'
import { zeitpunktKurz } from '@/api/termine/terminZeit'
import style from './ErgebnisAnzeige.module.scss'

/**
 * Seitenlinie in der Leibchenfarbe des Siegers (seit 24.10.2026), grau bei Unentschieden. Wiederholt nur, was der Satz
 * sagt; wer die Teams im Kopf hat, erkennt den Sieger auf einen Blick.
 */
const SIEGER_KLASSE = { A: style.siegerA, B: style.siegerB, U: style.unentschieden } as const

/** Eigenschaften der Ergebnisanzeige. */
type ErgebnisAnzeigeEigenschaften = {
  /** Das Ergebnis, wie `TerminDetails.ergebnis` es liefert. */
  ergebnis: Ergebnis
  /** Ziel für den Fokus, wenn das Ergebnis erscheint (nach dem Erfassen, nach `ERGEBNIS_VORHANDEN`). */
  ueberschriftRef?: Ref<HTMLHeadingElement>
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Das erfasste Ergebnis eines Termins, nur lesend (A21).
 *
 * „Team A hat gewonnen.“, „Team B hat gewonnen.“ oder „Unentschieden.“; ein
 * deutlicher Sieg steht im Satz selbst („hat deutlich gewonnen“) und nicht als
 * eigenes Zeichen. **Bei `U` ist `deutlich` immer `false`**, die Anzeige kennt
 * dafür keinen Haken. Darunter steht, wer es wann erfasst hat und – wenn der
 * Admin es korrigierte – wann zuletzt. `erfasstVon` ist eine Kopie zum
 * Zeitpunkt der Erfassung, kein Verweis: Auch ein später gelöschtes Profil lässt
 * die Auskunft nicht leer werden.
 *
 * **Keine Bearbeitung** (E18): Die Korrektur ist Sache des Admins.
 */
export default function ErgebnisAnzeige({
  ergebnis,
  ueberschriftRef,
  'data-testid': testId = 'ergebnis-anzeige',
}: ErgebnisAnzeigeEigenschaften) {
  return (
    <section className={`${style.anzeige} ${SIEGER_KLASSE[ergebnis.sieger]}`} aria-labelledby="ergebnis-titel" data-testid={testId}>
      <h2 id="ergebnis-titel" className={style.titel} tabIndex={-1} ref={ueberschriftRef} data-testid={`${testId}-titel`}>
        Ergebnis
      </h2>
      <p className={style.satz} data-testid={`${testId}-satz`}>
        {ergebnisSatz(ergebnis.sieger, ergebnis.deutlich)}
      </p>
      <p className={style.angabe} data-testid={`${testId}-erfasst`}>
        Erfasst von {ergebnis.erfasstVon} am {zeitpunktKurz(ergebnis.erfasstAm)}
      </p>
      {ergebnis.korrigiertAm && (
        <p className={style.angabe} data-testid={`${testId}-korrigiert`}>
          Zuletzt korrigiert am {zeitpunktKurz(ergebnis.korrigiertAm)}
        </p>
      )}
    </section>
  )
}
