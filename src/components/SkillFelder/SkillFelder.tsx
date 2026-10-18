import { skillZahl, type SkillKategorie } from '@/api/admin/skills'
import Feld from '@/components/Feld/Feld'
import style from './SkillFelder.module.scss'

/** Eigenschaften der Skillfelder. */
type SkillFelderEigenschaften = {
  /** Die aktiven Kategorien in Anzeigereihenfolge (aus `useSkillKategorien`). */
  kategorien: SkillKategorie[]
  /** Eingaben je Schlüssel **als Text**: leer ist ein Zustand, 0 ein Wert. */
  werte: Record<string, string>
  /** Meldet eine Eingabe: Schlüssel der Kategorie und der neue Text. */
  beiAenderung: (schluessel: string, text: string) => void
  /** Fehlertexte vom Server je Schlüssel; sie gehen dem eigenen Hinweis vor. */
  fehler?: Record<string, string>
  /** Schlüssel von Kategorien, die in der Karte des Profils fehlen (E7): Hinweis „Noch nicht bewertet“. */
  nichtBewertet?: string[]
  /** Die Werte sind vorbelegt (Anlegen): ein Satz sagt, dass jeder Wert zu prüfen ist. */
  vorbelegtHinweis?: boolean
  /** Sperrt die Eingabe, solange gesendet wird. */
  schreibgeschuetzt?: boolean
}

/**
 * Eingabefelder für die Skillwerte eines Profils (C7, 5.3; nur im Profilformular, A12).
 *
 * **Das Formular entsteht aus den Kategorien**, die der Server liefert: Bezeichnung, Bereich und
 * Reihenfolge stammen von dort, nichts ist fest verdrahtet. **Die Werte bleiben Text** bis zum
 * Senden – `type="number"` ohne Umwandlung beim Tippen, damit ein leeres Feld nicht zur 0 wird.
 *
 * Ein nicht ganzzahliger oder ausserhalb des Bereichs liegender Wert bekommt am Feld einen Text,
 * sobald etwas eingetragen ist; ein leeres Feld bleibt still (das Formular erklärt, warum es
 * nicht speichert).
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
  return (
    <fieldset className={style.gruppe} data-testid="skill-felder">
      <legend className={style.titel}>Skillwerte</legend>
      {vorbelegtHinweis && (
        <p className={style.hinweis} data-testid="skill-vorbelegt-hinweis">
          Die Werte sind vorbelegt (Mitte der Skala). Bitte prüfe jeden Wert.
        </p>
      )}
      <div className={style.felder}>
        {kategorien.map((kategorie) => {
          const text = werte[kategorie.schluessel] ?? ''
          const bereich = `${String(kategorie.minWert)} bis ${String(kategorie.maxWert)}`
          const eigenerFehler =
            text.trim() !== '' && skillZahl(text, kategorie) === null
              ? `Bitte eine ganze Zahl von ${bereich} eintragen.`
              : null
          return (
            <Feld
              key={kategorie.schluessel}
              beschriftung={kategorie.bezeichnung}
              hinweis={nichtBewertet.includes(kategorie.schluessel) ? `Noch nicht bewertet. ${bereich}` : bereich}
              fehler={fehler?.[kategorie.schluessel] ?? eigenerFehler}
              type="number"
              inputMode="numeric"
              min={kategorie.minWert}
              max={kategorie.maxWert}
              step={1}
              value={text}
              readOnly={schreibgeschuetzt}
              onChange={(e) => {
                beiAenderung(kategorie.schluessel, e.target.value)
              }}
              data-testid={`skill-${kategorie.schluessel}`}
            />
          )
        })}
      </div>
    </fieldset>
  )
}
