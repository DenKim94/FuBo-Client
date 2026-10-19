import { useId } from 'react'
import { skillZahl, type SkillKategorie } from '@/api/admin/skills'
import Segmente, { type SegmentOption } from '@/components/Segmente/Segmente'
import style from './SkillFelder.module.scss'

/** Eigenschaften der Skillfelder. */
type SkillFelderEigenschaften = {
  /** Die aktiven Kategorien in Anzeigereihenfolge (aus `useSkillKategorien`). */
  kategorien: SkillKategorie[]
  /** Eingaben je Schlüssel **als Text**: leer ist ein Zustand (keine Stufe gewählt), 0 ein Wert. */
  werte: Record<string, string>
  /** Meldet eine Wahl: Schlüssel der Kategorie und der neue Wert als Text. */
  beiAenderung: (schluessel: string, text: string) => void
  /** Fehlertexte vom Server je Schlüssel. */
  fehler?: Record<string, string>
  /** Schlüssel von Kategorien, die in der Karte des Profils fehlen (E7): Hinweis „Noch nicht bewertet“. */
  nichtBewertet?: string[]
  /** Die Werte sind vorbelegt (Anlegen): ein Satz sagt, dass jeder Wert zu prüfen ist. */
  vorbelegtHinweis?: boolean
  /** Sperrt die Wahl, solange gesendet wird. */
  schreibgeschuetzt?: boolean
}

/** Die Stufen einer Kategorie von der unteren bis zur oberen Grenze. */
function stufen(kategorie: SkillKategorie): SegmentOption[] {
  const anzahl = Math.max(0, kategorie.maxWert - kategorie.minWert + 1)
  return Array.from({ length: anzahl }, (_, i) => {
    const wert = String(kategorie.minWert + i)
    return { wert, text: wert }
  })
}

/**
 * Skillwerte eines Profils als Stufen zum Antippen (C7, 5.3; Prototyp 09b; nur im Profilformular, A12).
 *
 * **Segmente statt Zahlenfeld:** je Kategorie eine Reihe von Stufen von der unteren bis zur oberen Grenze, der
 * gewählte Wert steht zusätzlich als Zahl neben dem Namen (Prototyp: „treffsicher, Wert immer als Zahl lesbar“).
 * Ein ungültiger Wert lässt sich so gar nicht erst eingeben; geprüft wird weiterhin beim Senden.
 *
 * **Das Formular entsteht aus den Kategorien**, die der Server liefert: Bezeichnung, Bereich und Reihenfolge
 * stammen von dort, nichts ist fest verdrahtet (die Skala 0 bis 6 ist also ein Datenwert, kein Wert im Code).
 * **Die Werte bleiben Text** bis zum Senden: Kein Segment gewählt (`''`) ist etwas anderes als die Stufe 0.
 *
 * Kopfzeile: nur „Skills“ (der Durchschnitt daneben ist auf Wunsch des Entwicklers vom 18.10.2026 entfallen).
 */
export default function SkillFelder({
  kategorien,
  werte,
  beiAenderung,
  fehler,
  nichtBewertet = [],
  vorbelegtHinweis = false,
  schreibgeschuetzt = false,
}: SkillFelderEigenschaften) {
  const titelId = useId()

  return (
    <section className={style.karte} aria-labelledby={titelId} data-testid="skill-felder">
      <div className={style.kopf}>
        <h2 id={titelId} className={style.titel}>
          Skills
        </h2>
      </div>
      {vorbelegtHinweis && (
        <p className={style.hinweis} data-testid="skill-vorbelegt-hinweis">
          Die Werte sind vorbelegt (Mitte der Skala). Bitte prüfe jeden Wert.
        </p>
      )}
      <div className={style.kategorien}>
        {kategorien.map((kategorie) => {
          const text = werte[kategorie.schluessel] ?? ''
          const gueltig = skillZahl(text, kategorie) !== null
          return (
            <Segmente
              key={kategorie.schluessel}
              legende={
                <>
                  <span className={style.name}>{kategorie.bezeichnung}</span>{' '}
                  {/* Das Leerzeichen trennt Name und Wert im zugänglichen Namen der Gruppe („Zehnerwert 5“). */}
                  <span className={style.wert}>{gueltig ? text.trim() : '–'}</span>
                </>
              }
              optionen={stufen(kategorie)}
              wert={gueltig ? String(Number(text.trim())) : ''}
              beiAenderung={(wert) => {
                beiAenderung(kategorie.schluessel, wert)
              }}
              hinweis={nichtBewertet.includes(kategorie.schluessel) && !gueltig ? 'Noch nicht bewertet.' : undefined}
              fehler={fehler?.[kategorie.schluessel] ?? null}
              schreibgeschuetzt={schreibgeschuetzt}
              data-testid={`skill-${kategorie.schluessel}`}
            />
          )
        })}
      </div>
    </section>
  )
}
