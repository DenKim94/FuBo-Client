import type { AbsageEintrag } from '@/api/termine/termine'
import style from './Absagenliste.module.scss'

/** Eigenschaften der Absagenliste. */
type AbsagenlisteEigenschaften = {
  /** Die Absagen, alphabetisch, wie der Server sie liefert (`teilnehmerliste.absagen`). */
  absagen: readonly AbsageEintrag[]
  /** Anzeigename der eigenen Sitzung, um den eigenen Eintrag zu finden. */
  eigenerName: string | null | undefined
  /** `true` bei einer Gastsitzung; der Name allein genügt nicht, ein Gast könnte so heißen wie ein Profil. */
  eigenerGast: boolean
  /** Zugeklappt starten (Dashboard); auf der Termin-Ansicht offen – wie die Teilnehmerliste darüber. */
  eingeklappt: boolean
  /** Der Termin ist vorbei: Der Satz bei leerer Liste steht dann in der Vergangenheit. */
  beendet?: boolean
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Absagen eines Termins (Vertrag vom 06.11.2026), aufklappbar unter der Teilnehmerliste.
 *
 * **Gleiches Muster wie die Teilnehmerliste:** `<details>` mit Kopfzeile „Absagen (n)“, Rahmen, Pfeil und Linien aus
 * `_klappliste.scss`; der Pfeil erscheint erst, wenn es Absagen gibt. Der Aufrufer klappt beide Listen gleich ein.
 *
 * **Eine Liste ohne Rangfolge (`ul`):** Der Server sortiert alphabetisch, weil es keinen Absagezeitpunkt gibt; es gibt
 * keine Position und keine Warteschlange. Ein Eintrag trägt den Namen, „(Gast)“ (A8) und beim eigenen „(du)“.
 *
 * **Ohne Absagen** steht nur ein kurzer Satz statt eines Leerzustands mit Überschrift: Es gibt keinen nächsten Schritt,
 * und die Zusagen darüber sind die wichtigere Information.
 */
export default function Absagenliste({
  absagen,
  eigenerName,
  eigenerGast,
  eingeklappt,
  beendet = false,
  'data-testid': testId = 'absagenliste',
}: AbsagenlisteEigenschaften) {
  return (
    <details className={style.liste} open={!eingeklappt} data-testid={testId}>
      <summary className={style.zusammenfassung} data-testid={`${testId}-summary`}>
        Absagen ({absagen.length})
        {absagen.length > 0 && <span className={style.pfeil} aria-hidden="true" data-testid={`${testId}-pfeil`} />}
      </summary>

      {absagen.length === 0 ? (
        <p className={style.leer} data-testid={`${testId}-leer`}>
          {beendet ? 'Für diesen Termin gab es keine Absagen.' : 'Bisher hat niemand abgesagt.'}
        </p>
      ) : (
        <ul className={style.eintraege} aria-label="Absagen">
          {absagen.map((eintrag, index) => {
            const eigen = eintrag.anzeigeName === eigenerName && eintrag.gast === eigenerGast
            // Mit Index: Zwei Gäste dürfen gleich heißen; die Reihenfolge ändert sich nur mit neuen Daten.
            return (
              <li key={`${String(index)}-${eintrag.anzeigeName}`} className={style.eintrag} data-testid={`${testId}-eintrag`}>
                {eintrag.anzeigeName}
                {eintrag.gast && ' (Gast)'}
                {eigen && ' (du)'}
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )
}
