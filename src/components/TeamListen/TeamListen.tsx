import type { TeamEintrag } from '@/api/teams/teams'
import Icon from '@/components/Icon/Icon'
import style from './TeamListen.module.scss'

/** Eigenschaften der Teamlisten. */
type TeamListenEigenschaften = {
  /** Team A, in der Reihenfolge der Lieferung. */
  teamA: readonly TeamEintrag[]
  /** Team B, in der Reihenfolge der Lieferung. */
  teamB: readonly TeamEintrag[]
  /** Anzeigename der eigenen Sitzung, um den eigenen Eintrag zu finden; ohne Angabe gibt es kein „(du)“. */
  eigenerName?: string | null
  /** `true` bei einer Gastsitzung; der Name allein genügt nicht, ein Gast könnte so heißen wie ein Profil. */
  eigenerGast?: boolean
  /** Präfix der Test-IDs: `<präfix>-a`, `<präfix>-b`, `<präfix>-auswechselspieler`. */
  'data-testid'?: string
}

/**
 * Die beiden Teamspalten einer Einteilung (A20a, A20b, C8 5.9), herausgelöst aus `TeamsAnzeige`, weil auch die
 * manuelle Generierung des Admins dieselben Listen zeigt.
 *
 * **Keine Rangfolge:** Die Reihenfolge in `teamA` und `teamB` bedeutet nichts, sie wird wie geliefert angezeigt. Ein
 * Eintrag trägt Name, „(Gast)“, optional „(du)“ und – genau einmal bei ungerader Zahl – „Auswechselspieler“ als Text mit
 * Symbol. **Keine Skillwerte und keine Gast-Stufe:** Die Listen kennen sie nicht.
 *
 * Die Teams sind `h3`; die Überschrift darüber (`h2`) gehört dem Aufrufer.
 */
export default function TeamListen({
  teamA,
  teamB,
  eigenerName,
  eigenerGast = false,
  'data-testid': testId = 'team-listen',
}: TeamListenEigenschaften) {
  return (
    <div className={style.listen}>
      <Team name="Team A" kennung="a" eintraege={teamA} eigenerName={eigenerName} eigenerGast={eigenerGast} testId={testId} />
      <Team name="Team B" kennung="b" eintraege={teamB} eigenerName={eigenerName} eigenerGast={eigenerGast} testId={testId} />
    </div>
  )
}

/** Ein Team als Abschnitt mit Überschrift und Liste; die Zahl zählt den Auswechselspieler mit. */
function Team({
  name,
  kennung,
  eintraege,
  eigenerName,
  eigenerGast,
  testId,
}: {
  name: string
  kennung: string
  eintraege: readonly TeamEintrag[]
  eigenerName: string | null | undefined
  eigenerGast: boolean
  testId: string
}) {
  const titelId = `${testId}-${kennung}-titel`
  return (
    <section
      className={`${style.team} ${kennung === 'a' ? style.teamA : style.teamB}`}
      aria-labelledby={titelId}
      data-testid={`${testId}-${kennung}`}
    >
      <h3 id={titelId} className={style.teamTitel}>
        {/* Leibchenfarbe: hilft beim Wiederfinden, die Aussage steht im Namen. */}
        <span className={style.marke} aria-hidden="true" />
        {name} ({eintraege.length})
      </h3>
      <ul className={style.liste}>
        {eintraege.map((eintrag) => {
          const eigen = eigenerName !== undefined && eintrag.anzeigeName === eigenerName && eintrag.gast === eigenerGast
          return (
            <li key={`${eintrag.anzeigeName}-${String(eintrag.gast)}`} className={style.eintrag}>
              <span className={style.name}>
                {eintrag.anzeigeName}
                {eintrag.gast && ' (Gast)'}
                {eigen && ' (du)'}
              </span>
              {eintrag.auswechselspieler && (
                <span className={style.auswechsel} data-testid={`${testId}-auswechselspieler`}>
                  <Icon name="person_edit_dark" groesse={1.25} />
                  <span>Auswechselspieler</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
