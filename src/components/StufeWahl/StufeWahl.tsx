import type { GastStufe } from '@/api/admin/adminTermine'
import Segmente, { type SegmentOption } from '@/components/Segmente/Segmente'

/** Die drei Stufen der Selbsteinschätzung, von stark nach schwach (A8). */
const STUFEN: readonly SegmentOption[] = [
  { wert: 'STARK', text: 'Stark' },
  { wert: 'MITTEL', text: 'Mittel' },
  { wert: 'SCHWACH', text: 'Schwach' },
]

/** Eigenschaften der Stufenwahl. */
type StufeWahlEigenschaften = {
  /** Beschriftung der Gruppe (`<legend>`). */
  legende: string
  /** Gewählte Stufe; `null` heißt: nichts gewählt (Pflichtwahl). */
  wert: GastStufe | null
  /** Meldet die Wahl. */
  beiAenderung: (stufe: GastStufe) => void
  /** Sperrt die Wahl, solange gesendet wird. */
  schreibgeschuetzt?: boolean
  /** Dauerhafter Hilfetext unter der Gruppe. */
  hinweis?: string
  /** Fehlertext; macht die Gruppe als ungültig kenntlich. */
  fehler?: string | null
  /** Test-ID der Gruppe; die Stufe heißt `<test-id>-STARK`, `-MITTEL`, `-SCHWACH`. */
  'data-testid'?: string
}

/**
 * Wahl der Skill-Stufe eines Gastes: Stark, Mittel oder Schwach (C8, 5.8).
 *
 * Eine **Radiogruppe** (`fieldset`/`legend`, native Radios, Pfeiltasten) über {@link Segmente}, wie alle Wahlen mit
 * wenigen, auf einen Blick sichtbaren Möglichkeiten. **Keine Vorauswahl ist erlaubt** (`wert={null}`): Die Stufe ist
 * Pflicht, und der Aufrufer sperrt sein „Speichern“, bis gewählt ist – eine unsichtbare Vorgabe würde eine Stufe
 * behaupten, die niemand gewählt hat. Wiederverwendet im Dialog der Gast-Stufe im Termin (ohne Vorauswahl, wenn die
 * aktuelle Stufe nicht vorliegt) und in den Gastzeilen der manuellen Generierung (dort mit `MITTEL` sichtbar
 * vorbelegt).
 */
export default function StufeWahl({
  legende,
  wert,
  beiAenderung,
  schreibgeschuetzt,
  hinweis,
  fehler,
  'data-testid': testId = 'stufe-wahl',
}: StufeWahlEigenschaften) {
  return (
    <Segmente
      legende={legende}
      optionen={STUFEN}
      wert={wert ?? ''}
      beiAenderung={(neu) => beiAenderung(neu as GastStufe)}
      schreibgeschuetzt={schreibgeschuetzt}
      hinweis={hinweis}
      fehler={fehler}
      data-testid={testId}
    />
  )
}
