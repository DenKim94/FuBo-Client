import type { Teilnehmerliste as TeilnehmerlisteDaten } from '@/api/termine/termine'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import style from './Teilnehmerliste.module.scss'

/** Eigenschaften der Teilnehmerliste. */
type TeilnehmerlisteEigenschaften = {
  /** Die Liste samt Mindest- und Höchstzahl, wie der Server sie liefert. */
  liste: TeilnehmerlisteDaten
  /** Anzeigename der eigenen Sitzung, um den eigenen Eintrag zu finden. */
  eigenerName: string | null | undefined
  /** `true` bei einer Gastsitzung; der Name allein genügt nicht, ein Gast könnte so heißen wie ein Profil. */
  eigenerGast: boolean
  /** Zugeklappt starten (Dashboard); auf der Termin-Ansicht offen. */
  eingeklappt: boolean
  /** Der Termin ist vorbei: Der Leerzustand nennt dann nur den Grund, keinen nächsten Schritt. */
  beendet?: boolean
  /**
   * Nur lesen (Admin, C7 E2): Der Admin sagt nicht zu; der Leerzustand fordert ihn deshalb nicht dazu auf, sondern sagt,
   * was geschieht (24.10.2026).
   */
  nurLesen?: boolean
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Teilnehmerliste samt Warteschlange (A10, A11).
 *
 * **Eine geordnete Liste, nie umsortiert und nie in zwei Arrays geteilt:** Die
 * Reihenfolge ist die eine Information, die Zusagen und Warteschlange verbindet,
 * und `position` stimmt nur mit der Anzeige überein, solange niemand sie
 * verändert. Wartende tragen den Text „wartet · Platz n“ (n = Position minus
 * Höchstzahl); die Aussage hängt damit nicht an einer Farbe.
 *
 * Über dem ersten wartenden Eintrag steht ein Satz zur Warteschlange, als Teil
 * dieses Listeneintrags und nicht als Zeile ohne Bedeutung in der Liste.
 *
 * Aufklappen über `<details>`: nativ bedienbar mit Tastatur und Screenreader. **Ein Pfeil rechts in der
 * Zusammenfassung** zeigt, dass sich die Liste auf- und zuklappen lässt (nach unten: zu, nach oben: offen); er
 * erscheint erst, wenn es Zusagen gibt (Vorgabe 19.10.2026). Er ist schmückend (`aria-hidden`): Den Zustand
 * meldet `<details>` dem Screenreader selbst.
 * Keine Skillwerte, keine Kürzel und keine Zusammenfassung „und 11 weitere“.
 */
export default function Teilnehmerliste({
  liste,
  eigenerName,
  eigenerGast,
  eingeklappt,
  beendet = false,
  nurLesen = false,
  'data-testid': testId = 'teilnehmerliste',
}: TeilnehmerlisteEigenschaften) {
  const eintraege = liste.teilnehmer
  // Der erste Wartende bekommt den erklärenden Satz.
  const ersterWartender = eintraege.findIndex((e) => e.wartet)

  return (
    <details className={style.liste} open={!eingeklappt} data-testid={testId}>
      <summary className={style.zusammenfassung} data-testid={`${testId}-summary`}>
        Teilnehmer ({eintraege.length})
        {eintraege.length > 0 && <span className={style.pfeil} aria-hidden="true" data-testid={`${testId}-pfeil`} />}
      </summary>

      {eintraege.length === 0 ? (
        <Leerzustand
          titel={beendet ? 'Keine Zusagen' : 'Noch keine Zusagen'}
          text={
            beendet
              ? 'Für diesen Termin gab es keine Zusagen.'
              : nurLesen
                ? 'Sobald jemand zusagt, erscheint er hier.'
                : 'Sag zu, wenn du dabei bist.'
          }
          data-testid={`${testId}-leer`}
        />
      ) : (
        <ol className={style.eintraege} aria-label="Teilnehmer">
          {eintraege.map((eintrag, index) => {
            const eigen = eintrag.anzeigeName === eigenerName && eintrag.gast === eigenerGast
            return (
              <li
                key={eintrag.position}
                className={[style.eintrag, eintrag.wartet && style.wartet].filter(Boolean).join(' ')}
                data-testid={`${testId}-eintrag-${eintrag.position}`}
              >
                {index === ersterWartender && (
                  <p className={style.warteschlange} data-testid={`${testId}-warteschlange`}>
                    Warteschlange – bei einer Absage rückt Platz 1 nach.
                  </p>
                )}
                <div className={style.zeile}>
                  <span className={style.position}>{eintrag.position}</span>
                  <span className={style.name}>
                    {eintrag.anzeigeName}
                    {eintrag.gast && ' (Gast)'}
                    {eigen && ' (du)'}
                  </span>
                  {eintrag.wartet && (
                    <span className={style.platz}>wartet · Platz {eintrag.position - liste.maxTeilnehmer}</span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </details>
  )
}
