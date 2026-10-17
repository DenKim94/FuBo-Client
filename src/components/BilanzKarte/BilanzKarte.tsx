import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useBilanz } from '@/hooks/useBilanz'
import { useSitzung } from '@/hooks/useSitzung'
import style from './BilanzKarte.module.scss'

/**
 * Die eigene Bilanz als Karte: Siege, Niederlagen, Unentschieden (A21, E19).
 *
 * **Nicht für Gäste:** Ein Gast führt keine Bilanz; die Karte rendert dann nichts
 * und `useBilanz` ruft nichts ab. **Dreimal `0` heißt „nichts zu zeigen“** (der
 * Vertrag unterscheidet „noch nichts gewertet“ und „führt keine Bilanz“ absichtlich
 * nicht) und zeigt „Noch keine Spiele gewertet.“ statt dreier Nullen.
 *
 * Ein Fehler beim Laden ist eine kleine Meldung und blockiert die Seite nicht: Die
 * Bilanz ist Zugabe, das Ergebnis des Termins ist die Hauptsache. Der Auswechselspieler
 * zählt in allen drei Zählern mit (er hat gespielt).
 */
export default function BilanzKarte() {
  const { istGast } = useSitzung()
  const bilanz = useBilanz()

  if (istGast) return null

  const daten = bilanz.data
  const leer = daten !== undefined && daten.siege === 0 && daten.niederlagen === 0 && daten.unentschieden === 0

  return (
    <section className={style.karte} aria-labelledby="bilanz-titel" data-testid="bilanz-karte">
      <h2 id="bilanz-titel" className={style.titel}>
        Deine Bilanz
      </h2>
      {daten && !leer && (
        <dl className={style.zahlen}>
          <div className={style.zahl}>
            <dt>Siege</dt>
            <dd data-testid="bilanz-siege">{daten.siege}</dd>
          </div>
          <div className={style.zahl}>
            <dt>Niederlagen</dt>
            <dd data-testid="bilanz-niederlagen">{daten.niederlagen}</dd>
          </div>
          <div className={style.zahl}>
            <dt>Unentschieden</dt>
            <dd data-testid="bilanz-unentschieden">{daten.unentschieden}</dd>
          </div>
        </dl>
      )}
      {leer && (
        <p className={style.leer} data-testid="bilanz-leer">
          Noch keine Spiele gewertet.
        </p>
      )}
      {!daten && bilanz.isPending && <Ladespinner text="Bilanz wird geladen" />}
      {!daten && bilanz.isError && <Fehlermeldung fehler={bilanz.error} data-testid="bilanz-fehler" />}
    </section>
  )
}
